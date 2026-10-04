/**
 * NovTales (novtales.com).
 *
 * Version 2.0.2 talks to the NovTales Companion app on this phone instead of
 * fetching novtales.com from LNReader. Direct fetching answered with HTTP 429 and
 * browser-verification challenges, and the chapter text is delivered to the site's
 * own reader after a member grant, so an LNReader-side request could only ever
 * return a preview. The companion owns the WebView, the session and the site's
 * rate limits; this plugin owns the local transport and the LNReader shapes.
 *
 * Transport: http://127.0.0.1:5301, `Authorization: Bearer <pairing key>`.
 * Requests are asynchronous jobs: POST /v1/jobs returns 202 and a job id, then
 * GET /v1/jobs/{id} is polled once a second, easing to once every two seconds,
 * with a bounded total wait. Every request reads the pairing key from plugin
 * storage at call time; no key is ever compiled into this file.
 *
 * Paths are unchanged from 1.0.3 (`/novel/{slug}`, `/chapter/{slug}-{number}`),
 * so library entries created by the old plugin keep resolving after the update.
 *
 * Pagination is plugin-side. The companion slices its chapter index to the page
 * that was asked for, this plugin asks for `page: 1` once per novel to learn the
 * real chapter count, and reports `totalPages = ceil(count / 50)`. Earlier
 * versions mirrored the site's newest-first page numbers against the reader's
 * oldest-first ones, which produced byte-identical chapter lists for every page
 * and one full WebView index crawl per page.
 *
 * The site's own `chapterTotalPages` is a 12-per-page partition of the same
 * novel, so it is NOT a page count in this plugin's partition and is never
 * reported as one - doing so turned a degraded path into a truncation path.
 * Every page count this plugin reports comes from a chapter count; where none
 * is known, `parseNovel` reports a deliberate floor (`DEGRADED_TOTAL_PAGES`)
 * that can only over-report, because over-reporting costs one empty `chapters`
 * job and under-reporting hides the rest of the novel until the cache expires.
 *
 * A companion that predates that paging fix ignores `page` and re-serves the
 * whole novel. `chapterPage` recognises that (more than one page's worth, or a
 * page repeating an earlier one) and lays the novel out as pages locally, so
 * the plugin-first upgrade order degrades to correct-but-slower instead of
 * returning the same 120 chapters for every page.
 */
import { fetchApi } from '@libs/fetch';
import { storage } from '@libs/storage';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';
import { Filters, FilterTypes } from '@libs/filterInputs';
import { Plugin } from '@/types/plugin';

// ---------------------------------------------------------------------------
// Local API constants
// ---------------------------------------------------------------------------

/** Loopback only. The companion never binds a LAN or public interface. */
const COMPANION_ORIGIN = 'http://127.0.0.1:5301';

/** CONTRACTS.md Config.API_VERSION. Bumped independently of the website adapter. */
const COMPANION_API_VERSION = 1;

/** Spec section 7 polling: one second first, easing to two. */
const POLL_FAST_MS = 1000;
const POLL_SLOW_MS = 2000;
const POLL_FAST_POLLS = 10;

/**
 * Total wait bounds, so a stuck job can never turn into an endless poll.
 *
 * The companion's own ceilings are a 20s queue wait plus a 45s metadata deadline
 * or a 120s chapter deadline (Config.kt), after which `JobRunner` adds its own
 * 2s TIMEOUT_GRACE_MS backstop. This plugin also spends `QUEUE_FULL_RETRIES`
 * x 3s backing off inside the same budget, so the arithmetic that has to fit is:
 *
 *   retries x 3s  +  20s queue wait  +  45s deadline  +  2s grace
 *   = 9,000 + 20,000 + 45,000 + 2,000 = 76,000 ms
 *
 * The previous 75,000 ms missed that by one second. Chapter:
 *   9,000 + 20,000 + 120,000 + 2,000 = 151,000 ms.
 *
 * These are deliberately generous; a job that cannot finish inside them fails
 * retryably and stores nothing, which is the safe direction to be wrong in.
 */
const METADATA_BUDGET_MS = 95000;
const CHAPTER_BUDGET_MS = 175000;

/** QUEUE_FULL asks for a short wait and a retry, never for more browser work. */
const QUEUE_FULL_RETRIES = 3;
const QUEUE_FULL_RETRY_AFTER_MS = 3000;

/**
 * CONTRACTS.md fixes the `sort` field but not its vocabulary. These two match the
 * reader's Popular/Latest toggle. A companion that does not recognise them answers
 * BAD_REQUEST, and `catalogue()` then asks once more without a sort so the
 * companion's own default ordering is used instead of losing the source.
 */
const SORT_POPULAR = 'popular';
const SORT_LATEST = 'latest';

/** How long a novel's chapter-page count stays valid before it is re-read. */
const NOVEL_PAGE_TTL_MS = 5 * 60 * 1000;

/**
 * Chapters per page.
 *
 * This is the same number the companion uses, both when it asks the website's
 * public chapter index for a page and when it slices that index down to the
 * `page` a `chapters` job asked for (`CHAPTER_PAGE_SIZE` in
 * `WebViewBrowserGateway.kt`). The two must stay equal or the reader's page N
 * would not be the site's page N.
 *
 * `totalPages` below is therefore always `ceil(chapters / CHAPTER_PAGE_SIZE)`.
 * The website's own `chapterTotalPages` is never used: it partitions the same
 * novel 12 at a time, which is not the partition this plugin pages by, and
 * reusing it as a page count can truncate novels.
 */
const CHAPTER_PAGE_SIZE = 50;

/** How long a fetched chapter page stays usable before it is re-read. */
const CHAPTER_LIST_TTL_MS = 5 * 60 * 1000;

/** How many novels' chapter lists are held at once. */
const CHAPTER_LIST_CACHE_LIMIT = 8;

const PAIRING_KEY_STORAGE = 'companionPairingKey';

const NO_PAIRING_KEY_MESSAGE =
  'NovTales: no pairing key saved. Open NovTales Companion, copy its pairing key, ' +
  'then go to LNReader > Browse > Sources, tap the NovTales source name, then tap Filter. ' +
  'Long-press Companion pairing key (paste here), choose Paste, and tap Filter at the top-right of the panel to save.';

// ---------------------------------------------------------------------------
// Reader-facing failure messages, one per ErrorCode in core/Errors.kt
// ---------------------------------------------------------------------------

const MESSAGES: Record<string, string> = {
  COMPANION_UNAVAILABLE:
    'NovTales: the companion is not answering. Open NovTales Companion, press ' +
    'Start, leave it running, then try again.',
  UNAUTHORIZED:
    'NovTales: the pairing key was rejected. Copy the key from the companion ' +
    "again and paste it into this source's filter.",
  VERIFICATION_REQUIRED:
    'NovTales: the website asked for a browser check. Open NovTales Companion ' +
    'and finish it there, then retry. The plugin does not retry this for you.',
  SIGN_IN_REQUIRED:
    'NovTales: the website needs an account. Sign in inside NovTales Companion, ' +
    'then retry. The plugin does not retry this for you.',
  MEMBERSHIP_REQUIRED:
    'NovTales: this chapter needs a NovTales membership. Read it on the website ' +
    'with a membership, or use an account that has one.',
  RATE_LIMITED:
    'NovTales: the website is rate limiting requests. Wait a moment, then try again.',
  QUEUE_FULL:
    'NovTales: the companion is busy with another request. Try again in a few seconds.',
  TIMEOUT:
    'NovTales: the companion ran out of time. Nothing was saved - try again.',
  INCOMPLETE_CHAPTER:
    'NovTales: the chapter never finished loading, so nothing was saved. Try again.',
  WRONG_CHAPTER:
    'NovTales: the companion returned a different chapter than the one requested. ' +
    'Nothing was saved.',
  SITE_CHANGED:
    'NovTales: the website layout appears to have changed, so the companion could ' +
    'not read the page. Nothing was saved.',
  CANCELLED: 'NovTales: the request was cancelled.',
  BAD_REQUEST: 'NovTales: the companion rejected the request.',
  NOT_FOUND: 'NovTales: the companion could not find that page on the website.',
  INTERNAL: 'NovTales: the companion hit an internal error.',
};

/** Retryable defaults, matching `retryable` in core/Errors.kt. */
const RETRYABLE_CODES = [
  'COMPANION_UNAVAILABLE',
  'RATE_LIMITED',
  'QUEUE_FULL',
  'TIMEOUT',
  'INCOMPLETE_CHAPTER',
  'CANCELLED',
];

// ---------------------------------------------------------------------------
// Wire shapes (CONTRACTS.md sections 3 and 7)
// ---------------------------------------------------------------------------

type CompanionOperation =
  | 'catalogue'
  | 'search'
  | 'novel'
  | 'chapters'
  | 'chapter';

type CompanionJobState =
  | 'queued'
  | 'loading'
  | 'needs_user'
  | 'completed'
  | 'failed'
  | 'cancelled';

type CompanionErrorBody = {
  code?: string;
  message?: string;
  retryable?: boolean;
  retryAfterMs?: number;
};

type CompanionJobResponse = {
  apiVersion?: number;
  jobId?: string;
  state?: CompanionJobState;
  result?: unknown;
  error?: CompanionErrorBody;
  retryAfterMs?: number;
};

type JobFields = {
  path?: string;
  page?: number;
  query?: string;
  sort?: string;
};

type CompanionFailure = Error & {
  code: string;
  retryable: boolean;
  retryAfterMs?: number;
};

/**
 * One `chapters` result: the slice the companion served plus, when it knows
 * them, the size of the whole novel at the same page size. `chapterCount` and
 * `totalPages` are additive - a companion that does not send them is answered
 * for by the fallback in `knownTotalPages`.
 */
type CompanionChapterPage = {
  chapters?: unknown;
  chapterCount?: unknown;
  totalPages?: unknown;
};

/**
 * The per-novel chapter cache.
 *
 * The reader walks pages on demand, so a page is fetched the first time it is
 * asked for and served from here every time after that until the TTL expires.
 * `pages` holds them in the reader's own ascending order; once every page of
 * `totalPages` is present the cache also answers as one full list.
 */
type ChapterListCache = {
  /** 1-based page number -> the chapters the companion served for it. */
  pages: Record<number, Plugin.ChapterItem[]>;
  /** The novel's true chapter count, once a page has reported it. */
  chapterCount?: number;
  /** `ceil(chapterCount / CHAPTER_PAGE_SIZE)`, or undefined while unknown. */
  totalPages?: number;
  checkedAt: number;
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function failure(
  code: string,
  message: string,
  retryable: boolean,
  retryAfterMs?: number,
): CompanionFailure {
  return Object.assign(new Error(message), {
    code,
    retryable,
    retryAfterMs,
  });
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && isFinite(value) ? value : undefined;
}

function isPositiveInteger(value: number): boolean {
  return isFinite(value) && Math.floor(value) === value && value >= 1;
}

/**
 * How many pages a novel of [count] chapters occupies at
 * [CHAPTER_PAGE_SIZE] per page. Never below 1: LNReader asks for page 1 of
 * every novel it opens, so a novel with no chapters still needs one page to
 * exist.
 */
function pageCountOf(count: number): number {
  return Math.max(1, Math.ceil(Math.max(0, count) / CHAPTER_PAGE_SIZE));
}

/**
 * Whether a `chapters` answer is the whole novel rather than one page of it.
 *
 * Two independent signals, and neither of them can fire against a companion that
 * pages correctly:
 *
 *  - More than `CHAPTER_PAGE_SIZE` entries. No single page of a paged index is
 *    that long, so only a companion ignoring `page` produces one.
 *  - A chapter an earlier page already served. That is the only sound way to tell
 *    a pre-paging companion's whole novel apart from a current one answering
 *    `page: 1` of a longer novel: when the novel is exactly one page long, the
 *    two answers are byte-identical and no single page can tell them apart. It
 *    costs nothing on the happy path, because a sliced index never repeats.
 *
 * `entry.pages` must not yet contain the page being judged, so a novel is never
 * compared against itself.
 */
function servesWholeNovel(
  entry: ChapterListCache,
  chapters: Plugin.ChapterItem[],
): boolean {
  if (chapters.length > CHAPTER_PAGE_SIZE) return true;
  const seen: Record<string, boolean> = {};
  Object.keys(entry.pages).forEach(key => {
    entry.pages[Number(key)].forEach(chapter => {
      seen[chapter.path] = true;
    });
  });
  return chapters.some(chapter => seen[chapter.path] === true);
}

/** A cancelled job is not an error the reader needs to act on. */
function isCancelled(error: unknown): boolean {
  return asObject(error).code === 'CANCELLED';
}

/**
 * An HTML character reference, named (`&amp;`) or numeric (`&#160;`, `&#xA0;`).
 *
 * Entities are removed rather than decoded because an entity is a *spelling* of
 * a character, not text: `&amp;` is a bare ampersand, `&mdash;` a bare dash and
 * `&nbsp;` a space, so a body made only of those renders to nothing a reader can
 * read, and saving one would store a chapter that is empty in every sense but
 * its length. Real words around them are untouched - "Tom &amp; Jerry" and
 * "R&D" both still read as text.
 *
 * The minimum of two name characters is deliberate: it keeps a lone `&` in
 * "AT&T" and "Tom & Jerry" from being eaten as a malformed entity.
 */
const CHARACTER_REFERENCE =
  /&(?:#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});?/g;

function isPlainText(value: string): boolean {
  return (
    value
      .replace(/<[^>]*>/g, ' ')
      .replace(CHARACTER_REFERENCE, ' ')
      .replace(/\s+/g, ' ')
      .trim().length > 0
  );
}

// ---------------------------------------------------------------------------
// Path handling. Mirrors core/Paths.kt so the plugin never sends the companion a
// path its own validator would reject, and so library paths stay byte-identical
// to the 1.0.3 format.
// ---------------------------------------------------------------------------

function normalisePath(input: string): string {
  let value = (input || '').trim();
  value = value.replace(/^https?:\/\/novtales\.com/i, '');
  value = value.split(/[?#]/)[0];
  if (value.length > 0 && value.charAt(0) !== '/') value = '/' + value;
  if (value.length > 1 && value.charAt(value.length - 1) === '/') {
    value = value.slice(0, -1);
  }
  return value;
}

function novelSlug(path: string): string | undefined {
  const match = /^\/novel\/([a-z0-9]+(?:-[a-z0-9]+)*)$/i.exec(path);
  return match ? match[1] : undefined;
}

/**
 * `/chapter/{slug}-{number}`. The slug may contain hyphens and the number may be
 * decimal; `12.5` is returned as `12.5`, never `12.50` and never `12`.
 */
function chapterParts(
  path: string,
): { slug: string; number: string } | undefined {
  const match = /^\/chapter\/([a-z0-9]+(?:-[a-z0-9]+)*)-(\d+(?:\.\d+)?)$/i.exec(
    path,
  );
  return match ? { slug: match[1], number: match[2] } : undefined;
}

/** Same rule as `Paths.isSameChapter`: same slug, numerically equal number. */
function isSameChapter(requested: string, delivered: string): boolean {
  const asked = chapterParts(requested);
  const got = chapterParts(delivered);
  if (!asked || !got || asked.slug !== got.slug) return false;
  return (
    asked.number === got.number || Number(asked.number) === Number(got.number)
  );
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

class NovTales implements Plugin.PagePlugin {
  id = 'novtales';
  name = 'NovTales';
  icon = 'src/en/novtales/icon.png';
  site = 'https://novtales.com';
  version = '2.0.2';

  /**
   * Per-novel chapter page floors, re-read when they go stale.
   *
   * Written by `parseNovel` before its `chapters` job runs and read by
   * `parsePage` when the chapter cache has no count of its own. `totalPages` here
   * is never a measured chapter count - it is the floor described in
   * `DEGRADED_TOTAL_PAGES`, so it can only over-report. Pruned together with
   * `chapterLists` by `evictChapterCaches`.
   */
  private novelPages: Record<
    string,
    { totalPages: number; checkedAt: number }
  > = {};

  /**
   * Per-novel chapter pages, keyed by the novel path.
   *
   * This is what makes the pagination plugin-side: the reader asks for page 1,
   * then 2, then 3, and each of them costs one companion call the first time and
   * a lookup afterwards. Before this existed, every page re-ran a full serialised
   * WebView index crawl inside the companion, and every page came back with the
   * whole novel in it.
   */
  private chapterLists: Record<string, ChapterListCache> = {};

  /**
   * The runtime shows this as a text field on the source's filter sheet and sends
   * its value back only to `popularNovels`. Reading the stored key back into
   * `value` re-fills the field on the next visit; `popularNovels` is what writes
   * it to storage, because nothing else in the runtime persists it.
   */
  get filters(): Filters {
    return {
      pairingKey: {
        label: 'Companion pairing key (paste here)',
        type: FilterTypes.TextInput,
        value: readPairingKey(),
      },
    };
  }

  /** Kept on the real website so the reader's globe action still works. */
  resolveUrl(path: string): string {
    if (path.startsWith(this.site + '/')) return path;
    return this.site + (path.startsWith('/') ? path : '/' + path);
  }

  // -- transport ------------------------------------------------------------

  private async bounded<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([promise, new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(failure('COMPANION_UNAVAILABLE',
          'NovTales: the companion connection timed out. Open the companion and retry.', true)), 10000);
      })]);
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }

  private async companionFetch(
    route: string,
    init?: { method?: string; body?: string },
  ): Promise<Response> {
    const key = readPairingKey();
    if (!key) {
      throw failure('NO_PAIRING_KEY', NO_PAIRING_KEY_MESSAGE, false);
    }
    try {
      return await this.bounded(fetchApi(COMPANION_ORIGIN + route, {
        method: init?.method || 'GET',
        headers: {
          'Authorization': 'Bearer ' + key,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: init?.body,
      }));
    } catch (error) {
      // Nothing is listening, or the loopback connection was refused. The plugin
      // interface cannot start an Android service, so the reader must be told.
      throw failure(
        'COMPANION_UNAVAILABLE',
        MESSAGES.COMPANION_UNAVAILABLE,
        true,
      );
    }
  }

  private async companionJson(
    route: string,
    init?: { method?: string; body?: string },
  ): Promise<Record<string, unknown>> {
    const response = await this.companionFetch(route, init);
    let payload: unknown;
    try {
      payload = await this.bounded(response.json());
    } catch (error) {
      payload = undefined;
    }
    const body = asObject(payload);

    // A shape we do not recognise is rejected outright rather than misread.
    const version = asNumber(body.apiVersion);
    if (version !== undefined && version !== COMPANION_API_VERSION) {
      throw failure(
        'API_VERSION_MISMATCH',
        'NovTales: the companion speaks local API version ' +
          version +
          ', but this plugin expects version ' +
          COMPANION_API_VERSION +
          '. Update the companion app and this plugin together.',
        false,
      );
    }
    if (!response.ok) {
      throw this.failureFromBody(body, asNumber(body.retryAfterMs));
    }
    return body;
  }

  private failureFromBody(
    body: Record<string, unknown>,
    retryAfterMs?: number,
  ): CompanionFailure {
    // The companion nests the structured error under `error` for top-level HTTP
    // failures, exactly as `Job.toResponse` does for job failures. An earlier
    // version of this plugin read the code flat, so every HTTP-level failure
    // collapsed to INTERNAL and the reader was told "the companion hit an
    // internal error" instead of "copy the pairing key again". Read the nested
    // shape first and fall back to a flat one so both are understood.
    const nested = body.error as Record<string, unknown> | undefined;
    const envelope =
      nested && typeof nested === 'object' ? nested : ({} as Record<string, unknown>);

    const code = String(envelope.code || body.code || 'INTERNAL').toUpperCase();
    const base =
      MESSAGES[code] || 'NovTales: the companion reported ' + code + '.';
    const detail = asText(envelope.message) || asText(body.message);
    const rawRetryable =
      typeof envelope.retryable === 'boolean'
        ? envelope.retryable
        : typeof body.retryable === 'boolean'
          ? body.retryable
          : undefined;
    const retryable =
      rawRetryable !== undefined
        ? rawRetryable
        : RETRYABLE_CODES.indexOf(code) !== -1;
    return failure(
      code,
      detail ? base + ' (' + detail + ')' : base,
      retryable,
      asNumber(envelope.retryAfterMs) || asNumber(body.retryAfterMs) || retryAfterMs,
    );
  }

  /** Enqueue one operation and wait for it, bounded by `budgetMs`. */
  private async runJob(
    operation: CompanionOperation,
    fields: JobFields,
    budgetMs: number,
  ): Promise<unknown> {
    const body = JSON.stringify(Object.assign({ operation }, fields));
    const deadline = Date.now() + budgetMs;

    for (let attempt = 0; ; attempt++) {
      try {
        const accepted = await this.companionJson('/v1/jobs', {
          method: 'POST',
          body,
        });
        const jobId = asText(accepted.jobId);
        if (!jobId) {
          throw failure(
            'INTERNAL',
            'NovTales: the companion did not return a job id.',
            true,
          );
        }
        return await this.pollJob(jobId, deadline);
      } catch (error) {
        const queued = asObject(error);
        if (queued.code !== 'QUEUE_FULL' || attempt >= QUEUE_FULL_RETRIES) {
          throw error;
        }
        // Wait, do not start more browser work.
        await delay(asNumber(queued.retryAfterMs) || QUEUE_FULL_RETRY_AFTER_MS);
      }
    }
  }

  private async pollJob(jobId: string, deadline: number): Promise<unknown> {
    const route = '/v1/jobs/' + encodeURIComponent(jobId);
    for (let poll = 0; ; poll++) {
      const job = await this.companionJson(route);
      const state = job.state;

      if (state === 'completed') return job.result;

      // `needs_user` is terminal for this call: the reader has to finish
      // something in the companion and then ask again. Nothing loops here.
      if (state === 'failed' || state === 'needs_user') {
        const error = asObject(job.error);
        if (error.code) {
          throw this.failureFromBody(error, asNumber(job.retryAfterMs));
        }
        throw failure(
          'INTERNAL',
          'NovTales: the companion failed without saying why.',
          true,
        );
      }

      if (state === 'cancelled') {
        throw failure('CANCELLED', MESSAGES.CANCELLED, true);
      }

      if (state !== 'queued' && state !== 'loading') {
        throw failure(
          'INTERNAL',
          'NovTales: the companion returned an unknown job state "' +
            String(state) +
            '".',
          true,
        );
      }

      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        await this.cancelJob(route);
        throw failure('TIMEOUT', MESSAGES.TIMEOUT, true);
      }
      await delay(
        Math.min(
          poll < POLL_FAST_POLLS ? POLL_FAST_MS : POLL_SLOW_MS,
          remaining,
        ),
      );
    }
  }

  /** Best effort. The bounded wait already failed the job either way. */
  private async cancelJob(route: string): Promise<void> {
    try {
      await this.companionJson(route, { method: 'DELETE' });
    } catch {
      return;
    }
  }

  // -- result adaptation ----------------------------------------------------

  private novelItems(result: unknown): Plugin.NovelItem[] {
    const seen: Record<string, boolean> = {};
    const items: Plugin.NovelItem[] = [];
    asArray(asObject(result).items).forEach(entry => {
      const item = asObject(entry);
      const path = normalisePath(String(item.path || ''));
      // A malformed path would create a library entry that can never be opened.
      if (!novelSlug(path) || seen[path]) return;
      seen[path] = true;
      items.push({
        name: asText(item.name) || path,
        path,
        cover: asText(item.cover) || defaultCover,
      });
    });
    return items;
  }

  private chapterItems(result: unknown): Plugin.ChapterItem[] {
    const seen: Record<string, boolean> = {};
    const chapters: Plugin.ChapterItem[] = [];
    asArray(asObject(result).chapters).forEach(entry => {
      const item = asObject(entry);
      const path = normalisePath(String(item.path || ''));
      const parts = chapterParts(path);
      if (!parts || seen[path]) return;
      seen[path] = true;
      chapters.push({
        name: asText(item.name) || 'Chapter ' + parts.number,
        // The number is read back out of the path so the two can never disagree.
        path,
        chapterNumber: Number(parts.number),
        releaseTime: asText(item.releaseTime),
      });
    });
    // The companion already returns these ascending; sorting again is cheap and
    // keeps decimals (12.5) in order.
    chapters.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    return chapters;
  }

  private chapterCache(path: string): ChapterListCache | undefined {
    const cached = this.chapterLists[path];
    if (!cached) return undefined;
    return Date.now() - cached.checkedAt < CHAPTER_LIST_TTL_MS ? cached : undefined;
  }

  /**
   * Fetches one 1-based page of the novel's chapter list, or serves it from the
   * cache. Answers an empty list for a page past the end of the novel, which is
   * a normal answer and not a failure.
   *
   * The companion slices the index it crawled, so this is a real page and not
   * the whole novel. What the companion also reports about the novel as a whole
   * - `chapterCount` and `totalPages` - is folded into the cache, which is how a
   * client that only ever asks for page 1 still learns how many pages there are.
   *
   * Two answers are understood when the companion reports neither, because the
   * contract does not require them and an older companion sends neither:
   *
   *  - an empty page past the first is the end of the novel, and records where
   *    that is so the pages after it cost nothing at all;
   *  - a page that holds more than the reader's page size, or repeats chapters an
   *    earlier page already served, is the whole novel, and is laid out as pages
   *    here rather than being handed back whole.
   *
   * Neither can write over a count the companion actually sent.
   */
  private async chapterPage(
    path: string,
    page: number,
  ): Promise<Plugin.ChapterItem[]> {
    const cache = this.chapterCache(path);
    const held = cache?.pages[page];
    // `[]` is truthy, so a cached empty page is served rather than re-fetched.
    if (held) return held;

    const result = asObject(
      await this.runJob('chapters', { path, page }, CHAPTER_BUDGET_MS),
    ) as CompanionChapterPage;
    const chapters = this.chapterItems(result);

    const entry: ChapterListCache = cache || {
      pages: {},
      checkedAt: 0,
    };

    const count = asNumber(result.chapterCount);
    if (count !== undefined && count >= 0) {
      entry.chapterCount = Math.floor(count);
    }
    const pages = asNumber(result.totalPages);
    if (pages !== undefined && pages >= 1) {
      entry.totalPages = Math.floor(pages);
    } else if (entry.chapterCount !== undefined) {
      entry.totalPages = pageCountOf(entry.chapterCount);
    }

    // An empty page past the first is the end of the novel. Recorded only while
    // the count is unknown, so it can fill a blank and never contradict a number
    // the companion sent. Without it a degraded novel never learns where it ends,
    // and every page after the real end costs another crawl to learn the same.
    if (entry.totalPages === undefined && chapters.length === 0 && page > 1) {
      entry.totalPages = page - 1;
    }

    // A companion older than plugin-side paging ignores `page`. Asked before this
    // page is filed, so the comparison is against the pages before it only.
    const wholeNovel =
      entry.totalPages === undefined && servesWholeNovel(entry, chapters);

    entry.pages[page] = chapters;

    if (wholeNovel) {
      const total = pageCountOf(chapters.length);
      entry.chapterCount = chapters.length;
      entry.totalPages = total;
      for (let i = 1; i <= total; i++) {
        entry.pages[i] = chapters.slice(
          (i - 1) * CHAPTER_PAGE_SIZE,
          i * CHAPTER_PAGE_SIZE,
        );
      }
      // Asked for a page past the end of a novel we had not seen whole before.
      if (page > total) {
        delete entry.pages[page];
        entry.checkedAt = Date.now();
        this.chapterLists[path] = entry;
        this.evictChapterCaches();
        return [];
      }
    }

    entry.checkedAt = Date.now();
    this.chapterLists[path] = entry;
    this.evictChapterCaches();
    return entry.pages[page];
  }

  /**
   * Keeps the chapter cache to a fixed number of novels, least recently read
   * first, and prunes the page-count cache with it.
   *
   * A long novel is a few hundred `ChapterItem`s, so an unbounded map would grow
   * for the whole session across every novel the reader opens. Dropping the
   * coldest entries costs one companion call each, which is what the cache was
   * avoiding in the first place - so the cap is generous.
   *
   * The two maps used to be pruned independently, and only the first was pruned
   * at all. A novel whose chapter pages were dropped while its page count
   * survived was then "known" to be one page long, and `parsePage` answered the
   * rest of it empty without ever contacting the companion. Evicting both halves
   * of the same entry means an evicted novel is simply an unknown novel, which
   * costs a call and shows nothing.
   */
  private evictChapterCaches(): void {
    const paths = Object.keys(this.chapterLists);
    if (paths.length > CHAPTER_LIST_CACHE_LIMIT) {
      paths
        .sort((a, b) => this.chapterLists[a].checkedAt - this.chapterLists[b].checkedAt)
        .slice(0, paths.length - CHAPTER_LIST_CACHE_LIMIT)
        .forEach(path => {
          delete this.chapterLists[path];
          delete this.novelPages[path];
        });
    }
    // `parseNovel` records a page count even when its `chapters` job failed, so
    // this map can hold a novel the chapter cache never saw. It is bounded on its
    // own terms as well, or that would be an unbounded map all over again.
    const counts = Object.keys(this.novelPages);
    if (counts.length > CHAPTER_LIST_CACHE_LIMIT) {
      counts
        .sort((a, b) => this.novelPages[a].checkedAt - this.novelPages[b].checkedAt)
        .slice(0, counts.length - CHAPTER_LIST_CACHE_LIMIT)
        .forEach(path => {
          delete this.novelPages[path];
        });
    }
  }

  /**
   * The whole chapter list, once every page of it has been fetched.
   *
   * Returns undefined while any page is still missing - the reader walks pages
   * on demand, so the list completes as it reads rather than being built up
   * front for a novel nobody may ever finish.
   */
  private fullChapterList(path: string): Plugin.ChapterItem[] | undefined {
    const cache = this.chapterCache(path);
    if (!cache || cache.totalPages === undefined) return undefined;
    const list: Plugin.ChapterItem[] = [];
    for (let page = 1; page <= cache.totalPages; page++) {
      const slice = cache.pages[page];
      if (!slice) return undefined;
      list.push.apply(list, slice);
    }
    return list;
  }

  /**
   * How many pages this novel has, from the chapter cache when it knows and from
   * the floor `parseNovel` recorded otherwise.
   *
   * The second source is never a real count. It exists so that a page inside it
   * is still fetched rather than assumed empty, which is what keeps an evicted or
   * unread novel from reporting its later chapters as nonexistent. Because it is
   * only ever a floor (`DEGRADED_TOTAL_PAGES`, or the site's own page count where
   * that is larger), a page the reader asks for is fetched and answered honestly;
   * a real count, which is in this plugin's own partition, always wins over it.
   */
  private knownTotalPages(path: string): number | undefined {
    const chapters = this.chapterCache(path);
    if (chapters && chapters.totalPages !== undefined) {
      return chapters.totalPages;
    }
    const novel = this.novelPages[path];
    if (novel && Date.now() - novel.checkedAt < NOVEL_PAGE_TTL_MS) {
      return novel.totalPages;
    }
    return undefined;
  }

  /** Confirmed empty pages are normal; parser and website failures remain errors. */
  private async browse(
    operation: CompanionOperation,
    fields: JobFields,
  ): Promise<Plugin.NovelItem[]> {
    return this.novelItems(await this.runJob(operation, fields, METADATA_BUDGET_MS));
  }

  private async catalogue(
    pageNo: number,
    showLatestNovels?: boolean,
  ): Promise<Plugin.NovelItem[]> {
    const fields: JobFields = {
      page: pageNo,
      sort: showLatestNovels ? SORT_LATEST : SORT_POPULAR,
    };
    try {
      return await this.browse('catalogue', fields);
    } catch (error) {
      if (asObject(error).code !== 'BAD_REQUEST') throw error;
      // The companion does not know our sort vocabulary; fall back to its own
      // default ordering once rather than losing the source.
      return this.browse('catalogue', { page: pageNo });
    }
  }

  // -- Plugin.PagePlugin ----------------------------------------------------

  async popularNovels(
    pageNo: number,
    {
      showLatestNovels,
      filters,
    }: Plugin.PopularNovelsOptions<typeof this.filters> = { filters: this.filters },
  ): Promise<Plugin.NovelItem[]> {
    // The runtime hands filter values to this method only. Saving them here is
    // what lets searchNovels, parseNovel, parsePage and parseChapter find the
    // key. An empty field is ignored so a stray clear cannot lock out a key that
    // is already saved.
    const supplied = asText(asObject(asObject(filters).pairingKey).value);
    if (supplied && supplied !== readPairingKey()) {
      storage.set(PAIRING_KEY_STORAGE, supplied);
    }

    if (!isPositiveInteger(pageNo)) return [];
    try {
      return await this.catalogue(pageNo, showLatestNovels);
    } catch (error) {
      if (isCancelled(error)) return [];
      throw error;
    }
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const query = (searchTerm || '').trim();
    if (!query || !isPositiveInteger(pageNo)) return [];
    try {
      return await this.browse('search', { query, page: pageNo });
    } catch (error) {
      if (isCancelled(error)) return [];
      throw error;
    }
  }

  async parseNovel(
    novelPath: string,
  ): Promise<Plugin.SourceNovel & { totalPages: number }> {
    const path = normalisePath(novelPath);
    if (!novelSlug(path)) {
      throw new Error('NovTales: invalid novel path "' + novelPath + '".');
    }
    const novel = asObject(
      await this.runJob('novel', { path }, METADATA_BUDGET_MS),
    );

    const first = await this.chapterPage(path, 1);
    let totalPages = this.chapterCache(path)?.totalPages;
    if (totalPages === undefined && first.length < CHAPTER_PAGE_SIZE) {
      totalPages = pageCountOf(first.length);
    }
    if (totalPages === undefined) {
      const second = await this.chapterPage(path, 2);
      totalPages = this.chapterCache(path)?.totalPages;
      if (totalPages === undefined && second.length < CHAPTER_PAGE_SIZE) {
        totalPages = second.length === 0 ? 1 : 2;
      }
    }
    if (totalPages === undefined) {
      throw failure('SITE_CHANGED', 'NovTales: the chapter index did not report its full size. Update the companion and retry.', true);
    }
    this.novelPages[path] = { totalPages, checkedAt: Date.now() };

    const statuses: Record<string, string> = {
      ongoing: NovelStatus.Ongoing,
      completed: NovelStatus.Completed,
      hiatus: NovelStatus.OnHiatus,
      onhiatus: NovelStatus.OnHiatus,
      cancelled: NovelStatus.Cancelled,
      canceled: NovelStatus.Cancelled,
    };
    const status = String(novel.status || '')
      .toLowerCase()
      .replace(/[\s_]/g, '');
    // The contract sends a comma-separated string; an array is joined rather
    // than passed through so `genres` always matches Plugin.SourceNovel.
    const genres = Array.isArray(novel.genres)
      ? novel.genres.map(entry => String(entry)).join(', ')
      : asText(novel.genres);
    const rating = asNumber(novel.rating);

    return {
      path,
      name: asText(novel.name) || path,
      cover: asText(novel.cover) || defaultCover,
      summary: asText(novel.summary),
      author: asText(novel.author),
      genres,
      status: statuses[status] || NovelStatus.Unknown,
      rating: rating && rating > 0 ? rating : undefined,
      chapters: [],
      totalPages,
    };
  }

  async parsePage(novelPath: string, page: string): Promise<Plugin.SourcePage> {
    const path = normalisePath(novelPath);
    // The runtime sends the page as a string. Anything that is not a whole
    // number from 1 up is answered empty rather than guessed at.
    const pageNo = Number(page);
    if (!novelSlug(path) || !isPositiveInteger(pageNo)) {
      return { chapters: [] };
    }

    try {
      // Served locally once the whole list is cached.
      const complete = this.fullChapterList(path);
      if (complete) {
        const from = (pageNo - 1) * CHAPTER_PAGE_SIZE;
        return { chapters: complete.slice(from, from + CHAPTER_PAGE_SIZE) };
      }

      // A page past the end is a normal answer, not a failure, and costs no
      // companion call: the count is already known by the time it can be wrong.
      const known = this.knownTotalPages(path);
      if (known !== undefined && pageNo > known) {
        return { chapters: [] };
      }

      // Cache cold: one `chapters` job for this page alone. The companion slices
      // the index it crawled, so page 1 and page 2 are different chapters.
      return { chapters: await this.chapterPage(path, pageNo) };
    } catch (error) {
      if (isCancelled(error)) return { chapters: [] };
      throw error;
    }
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const requested = normalisePath(chapterPath);
    const asked = chapterParts(requested);
    if (!asked) {
      throw new Error('NovTales: invalid chapter path "' + chapterPath + '".');
    }
    const result = asObject(
      await this.runJob('chapter', { path: requested }, CHAPTER_BUDGET_MS),
    );
    return verifyChapter(requested, asked.number, result);
  }
}

/**
 * The correctness gate for a chapter download (CONTRACTS.md section 4, spec
 * section 8). An incomplete response, a different chapter, or a body with no
 * text in it must never become a successful download, so all three throw and
 * `parseChapter` returns nothing at all.
 */
function verifyChapter(
  requested: string,
  requestedNumber: string,
  result: Record<string, unknown>,
): string {
  // 1. The adapter must have declared the chapter complete. A preview, a spinner
  //    disappearing and a 200 response are all insufficient on their own.
  if (result.complete !== true) {
    throw failure('INCOMPLETE_CHAPTER', MESSAGES.INCOMPLETE_CHAPTER, true);
  }

  // 2. Same slug, numerically equal chapter number, decimals preserved.
  const delivered = normalisePath(String(result.path || ''));
  const parts = chapterParts(delivered);
  if (!parts || !isSameChapter(requested, delivered)) {
    throw failure(
      'WRONG_CHAPTER',
      'NovTales: the companion answered with "' +
        delivered +
        '" instead of "' +
        requested +
        '". Nothing was saved.',
      false,
    );
  }

  // 3. The number the adapter reported must agree with the one delivered.
  const reported = result.chapterNumber;
  if (reported !== undefined && reported !== null) {
    const text = String(reported);
    if (text !== parts.number && Number(text) !== Number(parts.number)) {
      throw failure(
        'WRONG_CHAPTER',
        'NovTales: the companion reported chapter ' +
          text +
          ' for the chapter ' +
          requested +
          '. Nothing was saved.',
        false,
      );
    }
    if (Number(text) !== Number(requestedNumber)) {
      throw failure(
        'WRONG_CHAPTER',
        'NovTales: the companion answered with chapter ' +
          text +
          ' instead of chapter ' +
          requestedNumber +
          '. Nothing was saved.',
        false,
      );
    }
  }

  // 4. Actual chapter text, returned verbatim. This side does not re-sanitise.
  const content = typeof result.content === 'string' ? result.content : '';
  if (!isPlainText(content)) {
    throw failure('INCOMPLETE_CHAPTER', MESSAGES.INCOMPLETE_CHAPTER, true);
  }
  return content;
}

/** The key is read from plugin storage at call time and never compiled in. */
function readPairingKey(): string {
  const stored = storage.get(PAIRING_KEY_STORAGE);
  return typeof stored === 'string' ? stored.trim() : '';
}

export default new NovTales();
