"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * NovTales (novtales.com).
 *
 * Version 2.0.1 talks to the NovTales Companion app on this phone instead of
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
var fetch_1 = require("@libs/fetch");
var storage_1 = require("@libs/storage");
var defaultCover_1 = require("@libs/defaultCover");
var novelStatus_1 = require("@libs/novelStatus");
var filterInputs_1 = require("@libs/filterInputs");
// ---------------------------------------------------------------------------
// Local API constants
// ---------------------------------------------------------------------------
/** Loopback only. The companion never binds a LAN or public interface. */
var COMPANION_ORIGIN = 'http://127.0.0.1:5301';
/** CONTRACTS.md Config.API_VERSION. Bumped independently of the website adapter. */
var COMPANION_API_VERSION = 1;
/** Spec section 7 polling: one second first, easing to two. */
var POLL_FAST_MS = 1000;
var POLL_SLOW_MS = 2000;
var POLL_FAST_POLLS = 10;
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
var METADATA_BUDGET_MS = 95000;
var CHAPTER_BUDGET_MS = 175000;
/** QUEUE_FULL asks for a short wait and a retry, never for more browser work. */
var QUEUE_FULL_RETRIES = 3;
var QUEUE_FULL_RETRY_AFTER_MS = 3000;
/**
 * CONTRACTS.md fixes the `sort` field but not its vocabulary. These two match the
 * reader's Popular/Latest toggle. A companion that does not recognise them answers
 * BAD_REQUEST, and `catalogue()` then asks once more without a sort so the
 * companion's own default ordering is used instead of losing the source.
 */
var SORT_POPULAR = 'popular';
var SORT_LATEST = 'latest';
/** How long a novel's chapter-page count stays valid before it is re-read. */
var NOVEL_PAGE_TTL_MS = 5 * 60 * 1000;
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
var CHAPTER_PAGE_SIZE = 50;
/** How long a fetched chapter page stays usable before it is re-read. */
var CHAPTER_LIST_TTL_MS = 5 * 60 * 1000;
/** How many novels' chapter lists are held at once. */
var CHAPTER_LIST_CACHE_LIMIT = 8;
var PAIRING_KEY_STORAGE = 'companionPairingKey';
var NO_PAIRING_KEY_MESSAGE = 'NovTales: no pairing key saved. Open NovTales Companion, copy its pairing key, ' +
    "then paste it into this source's 'Companion pairing key' filter and refresh.";
// ---------------------------------------------------------------------------
// Reader-facing failure messages, one per ErrorCode in core/Errors.kt
// ---------------------------------------------------------------------------
var MESSAGES = {
    COMPANION_UNAVAILABLE: 'NovTales: the companion is not answering. Open NovTales Companion, press ' +
        'Start, leave it running, then try again.',
    UNAUTHORIZED: 'NovTales: the pairing key was rejected. Copy the key from the companion ' +
        "again and paste it into this source's filter.",
    VERIFICATION_REQUIRED: 'NovTales: the website asked for a browser check. Open NovTales Companion ' +
        'and finish it there, then retry. The plugin does not retry this for you.',
    SIGN_IN_REQUIRED: 'NovTales: the website needs an account. Sign in inside NovTales Companion, ' +
        'then retry. The plugin does not retry this for you.',
    MEMBERSHIP_REQUIRED: 'NovTales: this chapter needs a NovTales membership. Read it on the website ' +
        'with a membership, or use an account that has one.',
    RATE_LIMITED: 'NovTales: the website is rate limiting requests. Wait a moment, then try again.',
    QUEUE_FULL: 'NovTales: the companion is busy with another request. Try again in a few seconds.',
    TIMEOUT: 'NovTales: the companion ran out of time. Nothing was saved - try again.',
    INCOMPLETE_CHAPTER: 'NovTales: the chapter never finished loading, so nothing was saved. Try again.',
    WRONG_CHAPTER: 'NovTales: the companion returned a different chapter than the one requested. ' +
        'Nothing was saved.',
    SITE_CHANGED: 'NovTales: the website layout appears to have changed, so the companion could ' +
        'not read the page. Nothing was saved.',
    CANCELLED: 'NovTales: the request was cancelled.',
    BAD_REQUEST: 'NovTales: the companion rejected the request.',
    NOT_FOUND: 'NovTales: the companion could not find that page on the website.',
    INTERNAL: 'NovTales: the companion hit an internal error.',
};
/** Retryable defaults, matching `retryable` in core/Errors.kt. */
var RETRYABLE_CODES = [
    'COMPANION_UNAVAILABLE',
    'RATE_LIMITED',
    'QUEUE_FULL',
    'TIMEOUT',
    'INCOMPLETE_CHAPTER',
    'CANCELLED',
];
// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function delay(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
function failure(code, message, retryable, retryAfterMs) {
    return Object.assign(new Error(message), {
        code: code,
        retryable: retryable,
        retryAfterMs: retryAfterMs,
    });
}
function asObject(value) {
    return value && typeof value === 'object'
        ? value
        : {};
}
function asArray(value) {
    return Array.isArray(value) ? value : [];
}
function asText(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function asNumber(value) {
    return typeof value === 'number' && isFinite(value) ? value : undefined;
}
function isPositiveInteger(value) {
    return isFinite(value) && Math.floor(value) === value && value >= 1;
}
/**
 * How many pages a novel of [count] chapters occupies at
 * [CHAPTER_PAGE_SIZE] per page. Never below 1: LNReader asks for page 1 of
 * every novel it opens, so a novel with no chapters still needs one page to
 * exist.
 */
function pageCountOf(count) {
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
function servesWholeNovel(entry, chapters) {
    if (chapters.length > CHAPTER_PAGE_SIZE)
        return true;
    var seen = {};
    Object.keys(entry.pages).forEach(function (key) {
        entry.pages[Number(key)].forEach(function (chapter) {
            seen[chapter.path] = true;
        });
    });
    return chapters.some(function (chapter) { return seen[chapter.path] === true; });
}
/** A cancelled job is not an error the reader needs to act on. */
function isCancelled(error) {
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
var CHARACTER_REFERENCE = /&(?:#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});?/g;
function isPlainText(value) {
    return (value
        .replace(/<[^>]*>/g, ' ')
        .replace(CHARACTER_REFERENCE, ' ')
        .replace(/\s+/g, ' ')
        .trim().length > 0);
}
// ---------------------------------------------------------------------------
// Path handling. Mirrors core/Paths.kt so the plugin never sends the companion a
// path its own validator would reject, and so library paths stay byte-identical
// to the 1.0.3 format.
// ---------------------------------------------------------------------------
function normalisePath(input) {
    var value = (input || '').trim();
    value = value.replace(/^https?:\/\/novtales\.com/i, '');
    value = value.split(/[?#]/)[0];
    if (value.length > 0 && value.charAt(0) !== '/')
        value = '/' + value;
    if (value.length > 1 && value.charAt(value.length - 1) === '/') {
        value = value.slice(0, -1);
    }
    return value;
}
function novelSlug(path) {
    var match = /^\/novel\/([a-z0-9]+(?:-[a-z0-9]+)*)$/i.exec(path);
    return match ? match[1] : undefined;
}
/**
 * `/chapter/{slug}-{number}`. The slug may contain hyphens and the number may be
 * decimal; `12.5` is returned as `12.5`, never `12.50` and never `12`.
 */
function chapterParts(path) {
    var match = /^\/chapter\/([a-z0-9]+(?:-[a-z0-9]+)*)-(\d+(?:\.\d+)?)$/i.exec(path);
    return match ? { slug: match[1], number: match[2] } : undefined;
}
/** Same rule as `Paths.isSameChapter`: same slug, numerically equal number. */
function isSameChapter(requested, delivered) {
    var asked = chapterParts(requested);
    var got = chapterParts(delivered);
    if (!asked || !got || asked.slug !== got.slug)
        return false;
    return (asked.number === got.number || Number(asked.number) === Number(got.number));
}
// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------
var NovTales = /** @class */ (function () {
    function NovTales() {
        this.id = 'novtales';
        this.name = 'NovTales';
        this.icon = 'src/en/novtales/icon.png';
        this.site = 'https://novtales.com';
        this.version = '2.0.1';
        /**
         * Per-novel chapter page floors, re-read when they go stale.
         *
         * Written by `parseNovel` before its `chapters` job runs and read by
         * `parsePage` when the chapter cache has no count of its own. `totalPages` here
         * is never a measured chapter count - it is the floor described in
         * `DEGRADED_TOTAL_PAGES`, so it can only over-report. Pruned together with
         * `chapterLists` by `evictChapterCaches`.
         */
        this.novelPages = {};
        /**
         * Per-novel chapter pages, keyed by the novel path.
         *
         * This is what makes the pagination plugin-side: the reader asks for page 1,
         * then 2, then 3, and each of them costs one companion call the first time and
         * a lookup afterwards. Before this existed, every page re-ran a full serialised
         * WebView index crawl inside the companion, and every page came back with the
         * whole novel in it.
         */
        this.chapterLists = {};
    }
    Object.defineProperty(NovTales.prototype, "filters", {
        /**
         * The runtime shows this as a text field on the source's filter sheet and sends
         * its value back only to `popularNovels`. Reading the stored key back into
         * `value` re-fills the field on the next visit; `popularNovels` is what writes
         * it to storage, because nothing else in the runtime persists it.
         */
        get: function () {
            return {
                pairingKey: {
                    label: 'Companion pairing key',
                    type: filterInputs_1.FilterTypes.TextInput,
                    value: readPairingKey(),
                },
            };
        },
        enumerable: false,
        configurable: true
    });
    /** Kept on the real website so the reader's globe action still works. */
    NovTales.prototype.resolveUrl = function (path) {
        if (path.startsWith(this.site + '/'))
            return path;
        return this.site + (path.startsWith('/') ? path : '/' + path);
    };
    // -- transport ------------------------------------------------------------
    NovTales.prototype.bounded = function (promise) {
        return __awaiter(this, void 0, void 0, function () {
            var timer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, , 2, 3]);
                        return [4 /*yield*/, Promise.race([promise, new Promise(function (_, reject) {
                                    timer = setTimeout(function () { return reject(failure('COMPANION_UNAVAILABLE', 'NovTales: the companion connection timed out. Open the companion and retry.', true)); }, 10000);
                                })])];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        if (timer !== undefined)
                            clearTimeout(timer);
                        return [7 /*endfinally*/];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    NovTales.prototype.companionFetch = function (route, init) {
        return __awaiter(this, void 0, void 0, function () {
            var key, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        key = readPairingKey();
                        if (!key) {
                            throw failure('NO_PAIRING_KEY', NO_PAIRING_KEY_MESSAGE, false);
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.bounded((0, fetch_1.fetchApi)(COMPANION_ORIGIN + route, {
                                method: (init === null || init === void 0 ? void 0 : init.method) || 'GET',
                                headers: {
                                    'Authorization': 'Bearer ' + key,
                                    'Content-Type': 'application/json',
                                    'Accept': 'application/json',
                                },
                                body: init === null || init === void 0 ? void 0 : init.body,
                            }))];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_1 = _a.sent();
                        // Nothing is listening, or the loopback connection was refused. The plugin
                        // interface cannot start an Android service, so the reader must be told.
                        throw failure('COMPANION_UNAVAILABLE', MESSAGES.COMPANION_UNAVAILABLE, true);
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    NovTales.prototype.companionJson = function (route, init) {
        return __awaiter(this, void 0, void 0, function () {
            var response, payload, error_2, body, version;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.companionFetch(route, init)];
                    case 1:
                        response = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.bounded(response.json())];
                    case 3:
                        payload = _a.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _a.sent();
                        payload = undefined;
                        return [3 /*break*/, 5];
                    case 5:
                        body = asObject(payload);
                        version = asNumber(body.apiVersion);
                        if (version !== undefined && version !== COMPANION_API_VERSION) {
                            throw failure('API_VERSION_MISMATCH', 'NovTales: the companion speaks local API version ' +
                                version +
                                ', but this plugin expects version ' +
                                COMPANION_API_VERSION +
                                '. Update the companion app and this plugin together.', false);
                        }
                        if (!response.ok) {
                            throw this.failureFromBody(body, asNumber(body.retryAfterMs));
                        }
                        return [2 /*return*/, body];
                }
            });
        });
    };
    NovTales.prototype.failureFromBody = function (body, retryAfterMs) {
        // The companion nests the structured error under `error` for top-level HTTP
        // failures, exactly as `Job.toResponse` does for job failures. An earlier
        // version of this plugin read the code flat, so every HTTP-level failure
        // collapsed to INTERNAL and the reader was told "the companion hit an
        // internal error" instead of "copy the pairing key again". Read the nested
        // shape first and fall back to a flat one so both are understood.
        var nested = body.error;
        var envelope = nested && typeof nested === 'object' ? nested : {};
        var code = String(envelope.code || body.code || 'INTERNAL').toUpperCase();
        var base = MESSAGES[code] || 'NovTales: the companion reported ' + code + '.';
        var detail = asText(envelope.message) || asText(body.message);
        var rawRetryable = typeof envelope.retryable === 'boolean'
            ? envelope.retryable
            : typeof body.retryable === 'boolean'
                ? body.retryable
                : undefined;
        var retryable = rawRetryable !== undefined
            ? rawRetryable
            : RETRYABLE_CODES.indexOf(code) !== -1;
        return failure(code, detail ? base + ' (' + detail + ')' : base, retryable, asNumber(envelope.retryAfterMs) || asNumber(body.retryAfterMs) || retryAfterMs);
    };
    /** Enqueue one operation and wait for it, bounded by `budgetMs`. */
    NovTales.prototype.runJob = function (operation, fields, budgetMs) {
        return __awaiter(this, void 0, void 0, function () {
            var body, deadline, attempt, accepted, jobId, error_3, queued;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        body = JSON.stringify(Object.assign({ operation: operation }, fields));
                        deadline = Date.now() + budgetMs;
                        attempt = 0;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 6]);
                        return [4 /*yield*/, this.companionJson('/v1/jobs', {
                                method: 'POST',
                                body: body,
                            })];
                    case 2:
                        accepted = _a.sent();
                        jobId = asText(accepted.jobId);
                        if (!jobId) {
                            throw failure('INTERNAL', 'NovTales: the companion did not return a job id.', true);
                        }
                        return [4 /*yield*/, this.pollJob(jobId, deadline)];
                    case 3: return [2 /*return*/, _a.sent()];
                    case 4:
                        error_3 = _a.sent();
                        queued = asObject(error_3);
                        if (queued.code !== 'QUEUE_FULL' || attempt >= QUEUE_FULL_RETRIES) {
                            throw error_3;
                        }
                        // Wait, do not start more browser work.
                        return [4 /*yield*/, delay(asNumber(queued.retryAfterMs) || QUEUE_FULL_RETRY_AFTER_MS)];
                    case 5:
                        // Wait, do not start more browser work.
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 6:
                        attempt++;
                        return [3 /*break*/, 1];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    NovTales.prototype.pollJob = function (jobId, deadline) {
        return __awaiter(this, void 0, void 0, function () {
            var route, poll, job, state, error, remaining;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        route = '/v1/jobs/' + encodeURIComponent(jobId);
                        poll = 0;
                        _a.label = 1;
                    case 1: return [4 /*yield*/, this.companionJson(route)];
                    case 2:
                        job = _a.sent();
                        state = job.state;
                        if (state === 'completed')
                            return [2 /*return*/, job.result];
                        // `needs_user` is terminal for this call: the reader has to finish
                        // something in the companion and then ask again. Nothing loops here.
                        if (state === 'failed' || state === 'needs_user') {
                            error = asObject(job.error);
                            if (error.code) {
                                throw this.failureFromBody(error, asNumber(job.retryAfterMs));
                            }
                            throw failure('INTERNAL', 'NovTales: the companion failed without saying why.', true);
                        }
                        if (state === 'cancelled') {
                            throw failure('CANCELLED', MESSAGES.CANCELLED, true);
                        }
                        if (state !== 'queued' && state !== 'loading') {
                            throw failure('INTERNAL', 'NovTales: the companion returned an unknown job state "' +
                                String(state) +
                                '".', true);
                        }
                        remaining = deadline - Date.now();
                        if (!(remaining <= 0)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.cancelJob(route)];
                    case 3:
                        _a.sent();
                        throw failure('TIMEOUT', MESSAGES.TIMEOUT, true);
                    case 4: return [4 /*yield*/, delay(Math.min(poll < POLL_FAST_POLLS ? POLL_FAST_MS : POLL_SLOW_MS, remaining))];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6:
                        poll++;
                        return [3 /*break*/, 1];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /** Best effort. The bounded wait already failed the job either way. */
    NovTales.prototype.cancelJob = function (route) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.companionJson(route, { method: 'DELETE' })];
                    case 1:
                        _b.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // -- result adaptation ----------------------------------------------------
    NovTales.prototype.novelItems = function (result) {
        var seen = {};
        var items = [];
        asArray(asObject(result).items).forEach(function (entry) {
            var item = asObject(entry);
            var path = normalisePath(String(item.path || ''));
            // A malformed path would create a library entry that can never be opened.
            if (!novelSlug(path) || seen[path])
                return;
            seen[path] = true;
            items.push({
                name: asText(item.name) || path,
                path: path,
                cover: asText(item.cover) || defaultCover_1.defaultCover,
            });
        });
        return items;
    };
    NovTales.prototype.chapterItems = function (result) {
        var seen = {};
        var chapters = [];
        asArray(asObject(result).chapters).forEach(function (entry) {
            var item = asObject(entry);
            var path = normalisePath(String(item.path || ''));
            var parts = chapterParts(path);
            if (!parts || seen[path])
                return;
            seen[path] = true;
            chapters.push({
                name: asText(item.name) || 'Chapter ' + parts.number,
                // The number is read back out of the path so the two can never disagree.
                path: path,
                chapterNumber: Number(parts.number),
                releaseTime: asText(item.releaseTime),
            });
        });
        // The companion already returns these ascending; sorting again is cheap and
        // keeps decimals (12.5) in order.
        chapters.sort(function (a, b) { return (a.chapterNumber || 0) - (b.chapterNumber || 0); });
        return chapters;
    };
    NovTales.prototype.chapterCache = function (path) {
        var cached = this.chapterLists[path];
        if (!cached)
            return undefined;
        return Date.now() - cached.checkedAt < CHAPTER_LIST_TTL_MS ? cached : undefined;
    };
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
    NovTales.prototype.chapterPage = function (path, page) {
        return __awaiter(this, void 0, void 0, function () {
            var cache, held, result, _a, chapters, entry, count, pages, wholeNovel, total, i;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        cache = this.chapterCache(path);
                        held = cache === null || cache === void 0 ? void 0 : cache.pages[page];
                        // `[]` is truthy, so a cached empty page is served rather than re-fetched.
                        if (held)
                            return [2 /*return*/, held];
                        _a = asObject;
                        return [4 /*yield*/, this.runJob('chapters', { path: path, page: page }, CHAPTER_BUDGET_MS)];
                    case 1:
                        result = _a.apply(void 0, [_b.sent()]);
                        chapters = this.chapterItems(result);
                        entry = cache || {
                            pages: {},
                            checkedAt: 0,
                        };
                        count = asNumber(result.chapterCount);
                        if (count !== undefined && count >= 0) {
                            entry.chapterCount = Math.floor(count);
                        }
                        pages = asNumber(result.totalPages);
                        if (pages !== undefined && pages >= 1) {
                            entry.totalPages = Math.floor(pages);
                        }
                        else if (entry.chapterCount !== undefined) {
                            entry.totalPages = pageCountOf(entry.chapterCount);
                        }
                        // An empty page past the first is the end of the novel. Recorded only while
                        // the count is unknown, so it can fill a blank and never contradict a number
                        // the companion sent. Without it a degraded novel never learns where it ends,
                        // and every page after the real end costs another crawl to learn the same.
                        if (entry.totalPages === undefined && chapters.length === 0 && page > 1) {
                            entry.totalPages = page - 1;
                        }
                        wholeNovel = entry.totalPages === undefined && servesWholeNovel(entry, chapters);
                        entry.pages[page] = chapters;
                        if (wholeNovel) {
                            total = pageCountOf(chapters.length);
                            entry.chapterCount = chapters.length;
                            entry.totalPages = total;
                            for (i = 1; i <= total; i++) {
                                entry.pages[i] = chapters.slice((i - 1) * CHAPTER_PAGE_SIZE, i * CHAPTER_PAGE_SIZE);
                            }
                            // Asked for a page past the end of a novel we had not seen whole before.
                            if (page > total) {
                                delete entry.pages[page];
                                entry.checkedAt = Date.now();
                                this.chapterLists[path] = entry;
                                this.evictChapterCaches();
                                return [2 /*return*/, []];
                            }
                        }
                        entry.checkedAt = Date.now();
                        this.chapterLists[path] = entry;
                        this.evictChapterCaches();
                        return [2 /*return*/, entry.pages[page]];
                }
            });
        });
    };
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
    NovTales.prototype.evictChapterCaches = function () {
        var _this = this;
        var paths = Object.keys(this.chapterLists);
        if (paths.length > CHAPTER_LIST_CACHE_LIMIT) {
            paths
                .sort(function (a, b) { return _this.chapterLists[a].checkedAt - _this.chapterLists[b].checkedAt; })
                .slice(0, paths.length - CHAPTER_LIST_CACHE_LIMIT)
                .forEach(function (path) {
                delete _this.chapterLists[path];
                delete _this.novelPages[path];
            });
        }
        // `parseNovel` records a page count even when its `chapters` job failed, so
        // this map can hold a novel the chapter cache never saw. It is bounded on its
        // own terms as well, or that would be an unbounded map all over again.
        var counts = Object.keys(this.novelPages);
        if (counts.length > CHAPTER_LIST_CACHE_LIMIT) {
            counts
                .sort(function (a, b) { return _this.novelPages[a].checkedAt - _this.novelPages[b].checkedAt; })
                .slice(0, counts.length - CHAPTER_LIST_CACHE_LIMIT)
                .forEach(function (path) {
                delete _this.novelPages[path];
            });
        }
    };
    /**
     * The whole chapter list, once every page of it has been fetched.
     *
     * Returns undefined while any page is still missing - the reader walks pages
     * on demand, so the list completes as it reads rather than being built up
     * front for a novel nobody may ever finish.
     */
    NovTales.prototype.fullChapterList = function (path) {
        var cache = this.chapterCache(path);
        if (!cache || cache.totalPages === undefined)
            return undefined;
        var list = [];
        for (var page = 1; page <= cache.totalPages; page++) {
            var slice = cache.pages[page];
            if (!slice)
                return undefined;
            list.push.apply(list, slice);
        }
        return list;
    };
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
    NovTales.prototype.knownTotalPages = function (path) {
        var chapters = this.chapterCache(path);
        if (chapters && chapters.totalPages !== undefined) {
            return chapters.totalPages;
        }
        var novel = this.novelPages[path];
        if (novel && Date.now() - novel.checkedAt < NOVEL_PAGE_TTL_MS) {
            return novel.totalPages;
        }
        return undefined;
    };
    /** Confirmed empty pages are normal; parser and website failures remain errors. */
    NovTales.prototype.browse = function (operation, fields) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.novelItems;
                        return [4 /*yield*/, this.runJob(operation, fields, METADATA_BUDGET_MS)];
                    case 1: return [2 /*return*/, _a.apply(this, [_b.sent()])];
                }
            });
        });
    };
    NovTales.prototype.catalogue = function (pageNo, showLatestNovels) {
        return __awaiter(this, void 0, void 0, function () {
            var fields, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        fields = {
                            page: pageNo,
                            sort: showLatestNovels ? SORT_LATEST : SORT_POPULAR,
                        };
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.browse('catalogue', fields)];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_4 = _a.sent();
                        if (asObject(error_4).code !== 'BAD_REQUEST')
                            throw error_4;
                        // The companion does not know our sort vocabulary; fall back to its own
                        // default ordering once rather than losing the source.
                        return [2 /*return*/, this.browse('catalogue', { page: pageNo })];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // -- Plugin.PagePlugin ----------------------------------------------------
    NovTales.prototype.popularNovels = function (pageNo_1) {
        return __awaiter(this, arguments, void 0, function (pageNo, _a) {
            var supplied, error_5;
            var _b = _a === void 0 ? { filters: this.filters } : _a, showLatestNovels = _b.showLatestNovels, filters = _b.filters;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        supplied = asText(asObject(asObject(filters).pairingKey).value);
                        if (supplied && supplied !== readPairingKey()) {
                            storage_1.storage.set(PAIRING_KEY_STORAGE, supplied);
                        }
                        if (!isPositiveInteger(pageNo))
                            return [2 /*return*/, []];
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.catalogue(pageNo, showLatestNovels)];
                    case 2: return [2 /*return*/, _c.sent()];
                    case 3:
                        error_5 = _c.sent();
                        if (isCancelled(error_5))
                            return [2 /*return*/, []];
                        throw error_5;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    NovTales.prototype.searchNovels = function (searchTerm, pageNo) {
        return __awaiter(this, void 0, void 0, function () {
            var query, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = (searchTerm || '').trim();
                        if (!query || !isPositiveInteger(pageNo))
                            return [2 /*return*/, []];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.browse('search', { query: query, page: pageNo })];
                    case 2: return [2 /*return*/, _a.sent()];
                    case 3:
                        error_6 = _a.sent();
                        if (isCancelled(error_6))
                            return [2 /*return*/, []];
                        throw error_6;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    NovTales.prototype.parseNovel = function (novelPath) {
        return __awaiter(this, void 0, void 0, function () {
            var path, novel, _a, first, totalPages, second, statuses, status, genres, rating;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        path = normalisePath(novelPath);
                        if (!novelSlug(path)) {
                            throw new Error('NovTales: invalid novel path "' + novelPath + '".');
                        }
                        _a = asObject;
                        return [4 /*yield*/, this.runJob('novel', { path: path }, METADATA_BUDGET_MS)];
                    case 1:
                        novel = _a.apply(void 0, [_d.sent()]);
                        return [4 /*yield*/, this.chapterPage(path, 1)];
                    case 2:
                        first = _d.sent();
                        totalPages = (_b = this.chapterCache(path)) === null || _b === void 0 ? void 0 : _b.totalPages;
                        if (totalPages === undefined && first.length < CHAPTER_PAGE_SIZE) {
                            totalPages = pageCountOf(first.length);
                        }
                        if (!(totalPages === undefined)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.chapterPage(path, 2)];
                    case 3:
                        second = _d.sent();
                        totalPages = (_c = this.chapterCache(path)) === null || _c === void 0 ? void 0 : _c.totalPages;
                        if (totalPages === undefined && second.length < CHAPTER_PAGE_SIZE) {
                            totalPages = second.length === 0 ? 1 : 2;
                        }
                        _d.label = 4;
                    case 4:
                        if (totalPages === undefined) {
                            throw failure('SITE_CHANGED', 'NovTales: the chapter index did not report its full size. Update the companion and retry.', true);
                        }
                        this.novelPages[path] = { totalPages: totalPages, checkedAt: Date.now() };
                        statuses = {
                            ongoing: novelStatus_1.NovelStatus.Ongoing,
                            completed: novelStatus_1.NovelStatus.Completed,
                            hiatus: novelStatus_1.NovelStatus.OnHiatus,
                            onhiatus: novelStatus_1.NovelStatus.OnHiatus,
                            cancelled: novelStatus_1.NovelStatus.Cancelled,
                            canceled: novelStatus_1.NovelStatus.Cancelled,
                        };
                        status = String(novel.status || '')
                            .toLowerCase()
                            .replace(/[\s_]/g, '');
                        genres = Array.isArray(novel.genres)
                            ? novel.genres.map(function (entry) { return String(entry); }).join(', ')
                            : asText(novel.genres);
                        rating = asNumber(novel.rating);
                        return [2 /*return*/, {
                                path: path,
                                name: asText(novel.name) || path,
                                cover: asText(novel.cover) || defaultCover_1.defaultCover,
                                summary: asText(novel.summary),
                                author: asText(novel.author),
                                genres: genres,
                                status: statuses[status] || novelStatus_1.NovelStatus.Unknown,
                                rating: rating && rating > 0 ? rating : undefined,
                                chapters: [],
                                totalPages: totalPages,
                            }];
                }
            });
        });
    };
    NovTales.prototype.parsePage = function (novelPath, page) {
        return __awaiter(this, void 0, void 0, function () {
            var path, pageNo, complete, from, known, error_7;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        path = normalisePath(novelPath);
                        pageNo = Number(page);
                        if (!novelSlug(path) || !isPositiveInteger(pageNo)) {
                            return [2 /*return*/, { chapters: [] }];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        complete = this.fullChapterList(path);
                        if (complete) {
                            from = (pageNo - 1) * CHAPTER_PAGE_SIZE;
                            return [2 /*return*/, { chapters: complete.slice(from, from + CHAPTER_PAGE_SIZE) }];
                        }
                        known = this.knownTotalPages(path);
                        if (known !== undefined && pageNo > known) {
                            return [2 /*return*/, { chapters: [] }];
                        }
                        _a = {};
                        return [4 /*yield*/, this.chapterPage(path, pageNo)];
                    case 2: 
                    // Cache cold: one `chapters` job for this page alone. The companion slices
                    // the index it crawled, so page 1 and page 2 are different chapters.
                    return [2 /*return*/, (_a.chapters = _b.sent(), _a)];
                    case 3:
                        error_7 = _b.sent();
                        if (isCancelled(error_7))
                            return [2 /*return*/, { chapters: [] }];
                        throw error_7;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    NovTales.prototype.parseChapter = function (chapterPath) {
        return __awaiter(this, void 0, void 0, function () {
            var requested, asked, result, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        requested = normalisePath(chapterPath);
                        asked = chapterParts(requested);
                        if (!asked) {
                            throw new Error('NovTales: invalid chapter path "' + chapterPath + '".');
                        }
                        _a = asObject;
                        return [4 /*yield*/, this.runJob('chapter', { path: requested }, CHAPTER_BUDGET_MS)];
                    case 1:
                        result = _a.apply(void 0, [_b.sent()]);
                        return [2 /*return*/, verifyChapter(requested, asked.number, result)];
                }
            });
        });
    };
    return NovTales;
}());
/**
 * The correctness gate for a chapter download (CONTRACTS.md section 4, spec
 * section 8). An incomplete response, a different chapter, or a body with no
 * text in it must never become a successful download, so all three throw and
 * `parseChapter` returns nothing at all.
 */
function verifyChapter(requested, requestedNumber, result) {
    // 1. The adapter must have declared the chapter complete. A preview, a spinner
    //    disappearing and a 200 response are all insufficient on their own.
    if (result.complete !== true) {
        throw failure('INCOMPLETE_CHAPTER', MESSAGES.INCOMPLETE_CHAPTER, true);
    }
    // 2. Same slug, numerically equal chapter number, decimals preserved.
    var delivered = normalisePath(String(result.path || ''));
    var parts = chapterParts(delivered);
    if (!parts || !isSameChapter(requested, delivered)) {
        throw failure('WRONG_CHAPTER', 'NovTales: the companion answered with "' +
            delivered +
            '" instead of "' +
            requested +
            '". Nothing was saved.', false);
    }
    // 3. The number the adapter reported must agree with the one delivered.
    var reported = result.chapterNumber;
    if (reported !== undefined && reported !== null) {
        var text = String(reported);
        if (text !== parts.number && Number(text) !== Number(parts.number)) {
            throw failure('WRONG_CHAPTER', 'NovTales: the companion reported chapter ' +
                text +
                ' for the chapter ' +
                requested +
                '. Nothing was saved.', false);
        }
        if (Number(text) !== Number(requestedNumber)) {
            throw failure('WRONG_CHAPTER', 'NovTales: the companion answered with chapter ' +
                text +
                ' instead of chapter ' +
                requestedNumber +
                '. Nothing was saved.', false);
        }
    }
    // 4. Actual chapter text, returned verbatim. This side does not re-sanitise.
    var content = typeof result.content === 'string' ? result.content : '';
    if (!isPlainText(content)) {
        throw failure('INCOMPLETE_CHAPTER', MESSAGES.INCOMPLETE_CHAPTER, true);
    }
    return content;
}
/** The key is read from plugin storage at call time and never compiled in. */
function readPairingKey() {
    var stored = storage_1.storage.get(PAIRING_KEY_STORAGE);
    return typeof stored === 'string' ? stored.trim() : '';
}
exports.default = new NovTales();
