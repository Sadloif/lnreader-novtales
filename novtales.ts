/**
 * NovTales (novtales.com).
 *
 * KNOWN BLOCKER — see novtales-validation/findings.md for the full evidence.
 *
 * The site is served behind Vercel's Security Checkpoint, which here admits only
 * clients whose TLS handshake matches a real browser. React Native's fetch (OkHttp
 * on Android) does not, so every request comes back HTTP 429 with
 * `x-vercel-mitigated: challenge`. Measured, not assumed:
 *
 *   - real Chrome, even headless and even forced to HTTP/1.1, gets 200 OK — with an
 *     EMPTY cookie jar, i.e. the checkpoint issues no session a plugin could reuse;
 *   - Node fetch sending the complete Chrome header set gets 429 over both HTTP/1.1
 *     and HTTP/2.
 *
 * Identical headers, identical HTTP version, identical IP — the only remaining
 * variable is the TLS ClientHello. No header, user agent, cookie or source-WebView
 * visit can change that, so this plugin reports the block honestly instead of asking
 * the user to retry something that cannot work.
 *
 * The parsing below is verified correct against the live site (212 catalogue entries,
 * 81 chapter pages, decimal and locked chapters), so this plugin resumes working
 * unchanged if NovTales narrows or removes the checkpoint. Chapter text additionally
 * requires a signed-in session: `POST /api/public/chapter-grant` returns 401 to
 * anonymous visitors and the served `.nv-chapter-body` is empty.
 */
import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { load as loadCheerio } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';

type CatalogueNovel = {
  slug: string;
  title: string;
  published?: boolean;
  coverUrl?: string;
  altNames?: string[];
  hearts?: number;
  added?: number;
};

type NovelData = {
  slug: string;
  title: string;
  author?: string;
  coverUrl?: string;
  synopsis?: string;
  genres?: string[];
  status?: string;
  ratingAverage?: number;
  chapterTotalPages: number;
  chapterList: {
    number: number;
    title: string;
    time?: string;
    locked?: boolean;
  }[];
};

// A genuine "slow down" 429 - as opposed to Vercel's deterministic challenge - earns a
// couple of short retries before the plugin gives up and asks the reader to wait.
const RATE_LIMIT_ATTEMPTS = 2;
const RATE_LIMIT_BACKOFF_MS = 1500;

// Next.js streams JSON text in several script elements. Decode the strings,
// without executing site JavaScript, before extracting a balanced JSON value.
function readPageData<T>(html: string, key: string): T {
  const $ = loadCheerio(html);
  let payload = '';
  $('script').each((_, element) => {
    const script = $(element).html() || '';
    const chunks =
      script.match(/self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/g) || [];
    chunks.forEach(chunk => {
      const encoded = chunk.slice(chunk.indexOf(',') + 1, -2);
      payload += JSON.parse(encoded) as string;
    });
  });

  const match = new RegExp('"' + key + '"\\s*:\\s*([\\[{])').exec(payload);
  if (match) {
    const start = match.index + match[0].length - 1;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < payload.length; index++) {
      const char = payload[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
      } else if (char === '"') inString = true;
      else if (char === '[' || char === '{') depth++;
      else if (char === ']' || char === '}') {
        depth--;
        if (depth === 0)
          return JSON.parse(payload.slice(start, index + 1)) as T;
      }
    }
  }
  throw new Error(
    'NovTales: missing ' + key + ' data. The site layout may have changed.',
  );
}

class NovTales implements Plugin.PagePlugin {
  id = 'novtales';
  name = 'NovTales';
  icon = 'src/en/novtales/icon.png';
  site = 'https://novtales.com';
  version = '1.0.3';
  filters = undefined;

  private chapterPages: Record<string, number> = {};

  resolveUrl(path: string): string {
    if (path.startsWith(this.site + '/')) return path;
    return this.site + (path.startsWith('/') ? path : '/' + path);
  }

  private novelPath(path: string): string {
    return path.replace(/^https:\/\/novtales\.com/, '').split(/[?#]/)[0];
  }

  private async request(path: string): Promise<string> {
    // Retry genuine rate limiting only. Vercel's checkpoint challenge is
    // deterministic: it carries `challenge: true` and is re-thrown immediately, so
    // the plugin never hammers a site that has told us to stop.
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.fetchOnce(path);
      } catch (error) {
        const failure = error as { status?: number; challenge?: boolean };
        const retryable =
          failure.status === 429 &&
          failure.challenge !== true &&
          attempt < RATE_LIMIT_ATTEMPTS;
        if (!retryable) throw error;
        await new Promise(resolve =>
          setTimeout(resolve, RATE_LIMIT_BACKOFF_MS * (attempt + 1)),
        );
      }
    }
  }

  private async fetchOnce(path: string): Promise<string> {
    // LNReader 2.1.4 preserves a Headers instance instead of adding its
    // synthetic fetch-metadata defaults. It still supplies the WebView UA.
    const response = await fetchApi(this.resolveUrl(path), {
      credentials: 'include',
      headers: new Headers({
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': this.site + '/',
      }),
    });
    const html = await response.text();
    if (
      response.headers.get('x-vercel-mitigated') === 'challenge' ||
      /Vercel Security Checkpoint|<title>Just a moment/i.test(html)
    ) {
      // Deliberately not "open the site in the source WebView and retry": that was
      // tested and cannot work. The checkpoint issues no cookie (a real browser gets
      // 200 with an empty jar) and rejects non-browser TLS fingerprints outright.
      throw Object.assign(
        new Error(
          'NovTales: blocked by the site\u2019s Vercel bot check (HTTP ' +
            response.status +
            '). Every non-browser client is rejected, and no header, cookie or ' +
            'source-WebView visit changes that \u2014 the check is on the TLS ' +
            'handshake. This source cannot be read while that protection is enabled.',
        ),
        { status: response.ok ? 403 : response.status, challenge: true },
      );
    }
    if (!response.ok) {
      const message =
        response.status === 429
          ? 'NovTales: too many requests (HTTP 429). Wait before retrying.'
          : 'NovTales: HTTP ' + response.status;
      throw Object.assign(new Error(message), { status: response.status });
    }
    return html;
  }

  private async catalogue(): Promise<CatalogueNovel[]> {
    const html = await this.request('/explore');
    const novels = readPageData<CatalogueNovel[]>(html, 'catalogue');
    if (!Array.isArray(novels)) throw new Error('NovTales: invalid catalogue.');
    return novels.filter(
      novel => novel.published !== false && novel.slug && novel.title,
    );
  }

  private results(
    novels: CatalogueNovel[],
    pageNo: number,
  ): Plugin.NovelItem[] {
    if (!Number.isInteger(pageNo) || pageNo < 1) return [];
    const start = (pageNo - 1) * 20;
    return novels.slice(start, start + 20).map(novel => ({
      name: novel.title,
      path: '/novel/' + novel.slug,
      cover: novel.coverUrl || defaultCover,
    }));
  }

  async popularNovels(
    pageNo: number,
    { showLatestNovels }: Plugin.PopularNovelsOptions,
  ): Promise<Plugin.NovelItem[]> {
    const novels = await this.catalogue();
    novels.sort((a, b) =>
      showLatestNovels
        ? (b.added || 0) - (a.added || 0)
        : (b.hearts || 0) - (a.hearts || 0),
    );
    return this.results(novels, pageNo);
  }

  async searchNovels(
    searchTerm: string,
    pageNo: number,
  ): Promise<Plugin.NovelItem[]> {
    const normalize = (text: string) =>
      text.toLowerCase().replace(/[‘’]/g, "'").trim();
    const query = normalize(searchTerm);
    const novels = (await this.catalogue()).filter(novel =>
      [novel.title]
        .concat(novel.altNames || [])
        .some(title => normalize(title).includes(query)),
    );
    return this.results(novels, pageNo);
  }

  async parseNovel(
    novelPath: string,
  ): Promise<Plugin.SourceNovel & { totalPages: number }> {
    const path = this.novelPath(novelPath);
    const data = readPageData<NovelData>(await this.request(path), 'novel');
    if (!data.title || !data.slug || !Array.isArray(data.chapterList)) {
      throw new Error('NovTales: invalid novel data.');
    }
    this.chapterPages[path] = Math.max(1, data.chapterTotalPages || 1);
    const statuses: Record<string, string> = {
      ONGOING: NovelStatus.Ongoing,
      COMPLETED: NovelStatus.Completed,
      HIATUS: NovelStatus.OnHiatus,
      CANCELLED: NovelStatus.Cancelled,
    };
    return {
      path,
      name: data.title,
      cover: data.coverUrl || defaultCover,
      author: data.author,
      summary: data.synopsis,
      genres: data.genres?.join(', '),
      status:
        statuses[(data.status || '').toUpperCase()] || NovelStatus.Unknown,
      rating: data.ratingAverage || undefined,
      totalPages: this.chapterPages[path],
      chapters: [],
    };
  }

  async parsePage(novelPath: string, page: string): Promise<Plugin.SourcePage> {
    const path = this.novelPath(novelPath);
    const pageNo = Number(page);
    if (!Number.isInteger(pageNo) || pageNo < 1) return { chapters: [] };
    if (!this.chapterPages[path]) await this.parseNovel(path);
    const totalPages = this.chapterPages[path];
    if (pageNo > totalPages) return { chapters: [] };
    // The site's pages run newest to oldest; LNReader's pages run oldest first.
    const html = await this.request(
      path + '?chapters=' + (totalPages - pageNo + 1),
    );
    const data = readPageData<NovelData>(html, 'novel');
    if (!Array.isArray(data.chapterList))
      throw new Error('NovTales: missing chapter list.');
    const chapters: Plugin.ChapterItem[] = data.chapterList.map(chapter => ({
      name: chapter.title + (chapter.locked ? ' 🔒' : ''),
      path: '/chapter/' + data.slug + '-' + chapter.number,
      chapterNumber: chapter.number,
      releaseTime: chapter.time,
    }));
    chapters.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));
    return { chapters };
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const $ = loadCheerio(await this.request(chapterPath));
    if (
      $('article h2')
        .toArray()
        .some(element => $(element).text().trim() === 'Unlock Access')
    ) {
      throw new Error(
        'NovTales: this chapter requires a membership. Open it on the website to access it.',
      );
    }
    const content = $('.nv-chapter-body').first();
    content
      .find(
        'script, style, button, [hidden], [aria-hidden="true"], [data-security-canary]',
      )
      .remove();
    if (!content.text().trim())
      throw new Error('NovTales: chapter text is unavailable.');
    return content.html() || '';
  }
}

export default new NovTales();
