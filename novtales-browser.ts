/**
 * NovTales (novtales.com).
 *
 * Public metadata is streamed in Next.js page data. Protected chapter HTML can
 * contain only a preview; the website loads the rest through its reader requests.
 * `locked` indicates protected delivery, while `membersOnly` indicates paid access.
 * Neither parser checks nor successful browser visits prove native app access.
 */
import { fetchApi } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { load as loadCheerio } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';
import * as browser from '@libs/browser';

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

type ChapterData = {
  number?: number;
  locked?: boolean;
  membersOnly?: boolean;
};

// A genuine "slow down" 429 earns a couple of short retries before the plugin gives up
// and asks the reader to wait.
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
  version = '1.1.0';
  filters = undefined;

  private chapterPages: Record<string, number> = {};
  private cachedCatalogue?: { novels: CatalogueNovel[]; until: number };

  private get browserAvailable(): boolean {
    return (
      browser?.supportsBrowserFetch === true &&
      typeof browser?.fetchBrowser === 'function'
    );
  }

  resolveUrl(path: string): string {
    if (path.startsWith(this.site + '/')) return path;
    return this.site + (path.startsWith('/') ? path : '/' + path);
  }

  private novelPath(path: string): string {
    return path.replace(/^https:\/\/novtales\.com/, '').split(/[?#]/)[0];
  }

  private async request(path: string): Promise<string> {
    if (this.browserAvailable) {
      const result = await browser.fetchBrowser(this.resolveUrl(path), {
        readySelector: 'script',
        readyText: this.novelPath(path).startsWith('/explore')
          ? 'catalogue'
          : 'novel',
      });
      return result.html;
    }
    // Retry genuine rate limiting only. A deterministic non-retryable response is
    // re-thrown immediately rather than retried.
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
      throw Object.assign(
        new Error(
          'NovTales: the site blocked this page request with browser verification (HTTP ' +
            response.status +
            ').',
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
    if (this.cachedCatalogue && this.cachedCatalogue.until > Date.now()) {
      return [...this.cachedCatalogue.novels];
    }
    const html = await this.request('/explore');
    const novels = readPageData<CatalogueNovel[]>(html, 'catalogue');
    if (!Array.isArray(novels)) throw new Error('NovTales: invalid catalogue.');
    const published = novels.filter(
      novel => novel.published !== false && novel.slug && novel.title,
    );
    if (this.browserAvailable) {
      this.cachedCatalogue = { novels: published, until: Date.now() + 300000 };
    }
    return [...published];
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
    const numberMatch = /-(\d+(?:\.\d+)?)$/.exec(this.novelPath(chapterPath));
    if (!numberMatch) throw new Error('NovTales: invalid chapter path.');
    const chapterNumber = Number(numberMatch[1]);
    const endMarker = 'End of Chapter ' + chapterNumber;
    const html = this.browserAvailable
      ? (
          await browser.fetchBrowser(this.resolveUrl(chapterPath), {
            readySelector: 'article span',
            readyText: endMarker,
            readyTextExact: true,
            instruction:
              'Read or scroll to the end so the website can load the complete chapter. It will then open in LNReader.',
          })
        ).html
      : await this.request(chapterPath);
    const $ = loadCheerio(html);
    if (
      $('article h2')
        .toArray()
        .some(element => $(element).text().trim() === 'Unlock Access')
    ) {
      throw new Error(
        'NovTales: this chapter requires a membership. Open it on the website to access it.',
      );
    }
    const chapter = readPageData<ChapterData>(html, 'chapter');
    if (chapter?.number !== undefined && chapter.number !== chapterNumber) {
      throw new Error('NovTales: the website returned a different chapter.');
    }
    // A nonempty body can still be the server-rendered preview. Only explicitly
    // unprotected chapter data confirms that this page contains the whole text.
    const browserComplete =
      this.browserAvailable &&
      chapter?.number === chapterNumber &&
      $('article span')
        .toArray()
        .some(
          element =>
            $(element).text().replace(/\s+/g, ' ').trim() === endMarker,
        );
    if (!chapter || (chapter.locked !== false && !browserComplete)) {
      throw new Error(
        chapter?.membersOnly
          ? 'NovTales: this chapter requires membership and protected reader delivery, which this plugin does not support.'
          : 'NovTales: this page contains a chapter preview. Full text requires protected reader delivery, which this plugin does not support.',
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
