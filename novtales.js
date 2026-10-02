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
var fetch_1 = require("@libs/fetch");
var cheerio_1 = require("cheerio");
var defaultCover_1 = require("@libs/defaultCover");
var novelStatus_1 = require("@libs/novelStatus");
// Next.js streams JSON text in several script elements. Decode the strings,
// without executing site JavaScript, before extracting a balanced JSON value.
function readPageData(html, key) {
    var $ = (0, cheerio_1.load)(html);
    var payload = '';
    $('script').each(function (_, element) {
        var script = $(element).html() || '';
        var chunks = script.match(/self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/g) || [];
        chunks.forEach(function (chunk) {
            var encoded = chunk.slice(chunk.indexOf(',') + 1, -2);
            payload += JSON.parse(encoded);
        });
    });
    var match = new RegExp('"' + key + '"\\s*:\\s*([\\[{])').exec(payload);
    if (match) {
        var start = match.index + match[0].length - 1;
        var depth = 0;
        var inString = false;
        var escaped = false;
        for (var index = start; index < payload.length; index++) {
            var char = payload[index];
            if (inString) {
                if (escaped)
                    escaped = false;
                else if (char === '\\')
                    escaped = true;
                else if (char === '"')
                    inString = false;
            }
            else if (char === '"')
                inString = true;
            else if (char === '[' || char === '{')
                depth++;
            else if (char === ']' || char === '}') {
                depth--;
                if (depth === 0)
                    return JSON.parse(payload.slice(start, index + 1));
            }
        }
    }
    throw new Error('NovTales: missing ' + key + ' data. The site layout may have changed.');
}
var NovTales = /** @class */ (function () {
    function NovTales() {
        this.id = 'novtales';
        this.name = 'NovTales';
        this.icon = 'src/en/novtales/icon.png';
        this.site = 'https://novtales.com';
        this.version = '1.0.1';
        this.filters = undefined;
        this.chapterPages = {};
    }
    NovTales.prototype.resolveUrl = function (path) {
        if (path.startsWith(this.site + '/'))
            return path;
        return this.site + (path.startsWith('/') ? path : '/' + path);
    };
    NovTales.prototype.novelPath = function (path) {
        return path.replace(/^https:\/\/novtales\.com/, '').split(/[?#]/)[0];
    };
    NovTales.prototype.request = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            var response, html, message;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, fetch_1.fetchApi)(this.resolveUrl(path), {
                            credentials: 'include',
                            headers: new Headers({
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                                'Accept-Language': 'en-US,en;q=0.9',
                                'Referer': this.site + '/',
                            }),
                        })];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.text()];
                    case 2:
                        html = _a.sent();
                        if (response.headers.get('x-vercel-mitigated') === 'challenge' ||
                            /Vercel Security Checkpoint|<title>Just a moment/i.test(html)) {
                            throw Object.assign(new Error('NovTales: browser verification blocked this request (HTTP ' +
                                response.status +
                                '). Open Explore in the source WebView, then return and retry.'), { status: response.ok ? 403 : response.status });
                        }
                        if (!response.ok) {
                            message = response.status === 429
                                ? 'NovTales: too many requests (HTTP 429). Wait before retrying.'
                                : 'NovTales: HTTP ' + response.status;
                            throw Object.assign(new Error(message), { status: response.status });
                        }
                        return [2 /*return*/, html];
                }
            });
        });
    };
    NovTales.prototype.catalogue = function () {
        return __awaiter(this, void 0, void 0, function () {
            var html, novels;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.request('/explore')];
                    case 1:
                        html = _a.sent();
                        novels = readPageData(html, 'catalogue');
                        if (!Array.isArray(novels))
                            throw new Error('NovTales: invalid catalogue.');
                        return [2 /*return*/, novels.filter(function (novel) { return novel.published !== false && novel.slug && novel.title; })];
                }
            });
        });
    };
    NovTales.prototype.results = function (novels, pageNo) {
        if (!Number.isInteger(pageNo) || pageNo < 1)
            return [];
        var start = (pageNo - 1) * 20;
        return novels.slice(start, start + 20).map(function (novel) { return ({
            name: novel.title,
            path: '/novel/' + novel.slug,
            cover: novel.coverUrl || defaultCover_1.defaultCover,
        }); });
    };
    NovTales.prototype.popularNovels = function (pageNo_1, _a) {
        return __awaiter(this, arguments, void 0, function (pageNo, _b) {
            var novels;
            var showLatestNovels = _b.showLatestNovels;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.catalogue()];
                    case 1:
                        novels = _c.sent();
                        novels.sort(function (a, b) {
                            return showLatestNovels
                                ? (b.added || 0) - (a.added || 0)
                                : (b.hearts || 0) - (a.hearts || 0);
                        });
                        return [2 /*return*/, this.results(novels, pageNo)];
                }
            });
        });
    };
    NovTales.prototype.searchNovels = function (searchTerm, pageNo) {
        return __awaiter(this, void 0, void 0, function () {
            var normalize, query, novels;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        normalize = function (text) {
                            return text.toLowerCase().replace(/[‘’]/g, "'").trim();
                        };
                        query = normalize(searchTerm);
                        return [4 /*yield*/, this.catalogue()];
                    case 1:
                        novels = (_a.sent()).filter(function (novel) {
                            return [novel.title]
                                .concat(novel.altNames || [])
                                .some(function (title) { return normalize(title).includes(query); });
                        });
                        return [2 /*return*/, this.results(novels, pageNo)];
                }
            });
        });
    };
    NovTales.prototype.parseNovel = function (novelPath) {
        return __awaiter(this, void 0, void 0, function () {
            var path, data, _a, statuses;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        path = this.novelPath(novelPath);
                        _a = readPageData;
                        return [4 /*yield*/, this.request(path)];
                    case 1:
                        data = _a.apply(void 0, [_c.sent(), 'novel']);
                        if (!data.title || !data.slug || !Array.isArray(data.chapterList)) {
                            throw new Error('NovTales: invalid novel data.');
                        }
                        this.chapterPages[path] = Math.max(1, data.chapterTotalPages || 1);
                        statuses = {
                            ONGOING: novelStatus_1.NovelStatus.Ongoing,
                            COMPLETED: novelStatus_1.NovelStatus.Completed,
                            HIATUS: novelStatus_1.NovelStatus.OnHiatus,
                            CANCELLED: novelStatus_1.NovelStatus.Cancelled,
                        };
                        return [2 /*return*/, {
                                path: path,
                                name: data.title,
                                cover: data.coverUrl || defaultCover_1.defaultCover,
                                author: data.author,
                                summary: data.synopsis,
                                genres: (_b = data.genres) === null || _b === void 0 ? void 0 : _b.join(', '),
                                status: statuses[(data.status || '').toUpperCase()] || novelStatus_1.NovelStatus.Unknown,
                                rating: data.ratingAverage || undefined,
                                totalPages: this.chapterPages[path],
                                chapters: [],
                            }];
                }
            });
        });
    };
    NovTales.prototype.parsePage = function (novelPath, page) {
        return __awaiter(this, void 0, void 0, function () {
            var path, pageNo, totalPages, html, data, chapters;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        path = this.novelPath(novelPath);
                        pageNo = Number(page);
                        if (!Number.isInteger(pageNo) || pageNo < 1)
                            return [2 /*return*/, { chapters: [] }];
                        if (!!this.chapterPages[path]) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.parseNovel(path)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        totalPages = this.chapterPages[path];
                        if (pageNo > totalPages)
                            return [2 /*return*/, { chapters: [] }];
                        return [4 /*yield*/, this.request(path + '?chapters=' + (totalPages - pageNo + 1))];
                    case 3:
                        html = _a.sent();
                        data = readPageData(html, 'novel');
                        if (!Array.isArray(data.chapterList))
                            throw new Error('NovTales: missing chapter list.');
                        chapters = data.chapterList.map(function (chapter) { return ({
                            name: chapter.title + (chapter.locked ? ' 🔒' : ''),
                            path: '/chapter/' + data.slug + '-' + chapter.number,
                            chapterNumber: chapter.number,
                            releaseTime: chapter.time,
                        }); });
                        chapters.sort(function (a, b) { return (a.chapterNumber || 0) - (b.chapterNumber || 0); });
                        return [2 /*return*/, { chapters: chapters }];
                }
            });
        });
    };
    NovTales.prototype.parseChapter = function (chapterPath) {
        return __awaiter(this, void 0, void 0, function () {
            var $, _a, content;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = cheerio_1.load;
                        return [4 /*yield*/, this.request(chapterPath)];
                    case 1:
                        $ = _a.apply(void 0, [_b.sent()]);
                        if ($('article h2')
                            .toArray()
                            .some(function (element) { return $(element).text().trim() === 'Unlock Access'; })) {
                            throw new Error('NovTales: this chapter requires a membership. Open it on the website to access it.');
                        }
                        content = $('.nv-chapter-body').first();
                        content
                            .find('script, style, button, [hidden], [aria-hidden="true"], [data-security-canary]')
                            .remove();
                        if (!content.text().trim())
                            throw new Error('NovTales: chapter text is unavailable.');
                        return [2 /*return*/, content.html() || ''];
                }
            });
        });
    };
    return NovTales;
}());
exports.default = new NovTales();
