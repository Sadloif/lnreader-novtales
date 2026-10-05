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
var defaultCover_1 = require("@libs/defaultCover");
var cheerio_1 = require("cheerio");
var MachineEditing = /** @class */ (function () {
    function MachineEditing() {
        this.id = 'mylasted';
        this.name = 'Machine Editing (MyLasted)';
        this.site = 'https://mylasted.blogspot.com';
        this.icon = 'src/en/mylasted/icon.png';
        this.version = '1.0.0';
    }
    MachineEditing.prototype.request = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, fetch_1.fetchApi)(url)];
                    case 1:
                        response = _a.sent();
                        if (!response.ok)
                            throw Object.assign(new Error("Machine Editing: HTTP ".concat(response.status, ".")), {
                                status: response.status,
                            });
                        return [2 /*return*/, response];
                }
            });
        });
    };
    MachineEditing.prototype.feed = function (label_1) {
        return __awaiter(this, arguments, void 0, function (label, start, summary) {
            var url, data, feed;
            var _a;
            if (start === void 0) { start = 1; }
            if (summary === void 0) { summary = false; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        url = "".concat(this.site, "/feeds/posts/").concat(summary ? 'summary' : 'default', "/-/").concat(encodeURIComponent(label), "?alt=json&max-results=150&start-index=").concat(start);
                        return [4 /*yield*/, this.request(url)];
                    case 1: return [4 /*yield*/, (_b.sent()).json()];
                    case 2:
                        data = _b.sent();
                        feed = data.feed;
                        if (!feed || !Number.isInteger(Number((_a = feed.openSearch$totalResults) === null || _a === void 0 ? void 0 : _a.$t)))
                            throw new Error('Machine Editing: the public feed could not be read.');
                        return [2 /*return*/, feed];
                }
            });
        });
    };
    MachineEditing.prototype.project = function (entry) {
        var _a, _b;
        var href = (_a = entry.link.find(function (link) { return link.rel === 'alternate'; })) === null || _a === void 0 ? void 0 : _a.href;
        if (!href)
            throw new Error('Machine Editing: a series address is missing.');
        var $ = (0, cheerio_1.load)(((_b = entry.content) === null || _b === void 0 ? void 0 : _b.$t) || '');
        return {
            name: entry.title.$t,
            path: new URL(this.resolveUrl(href)).pathname,
            cover: $('img').first().attr('src') || defaultCover_1.defaultCover,
        };
    };
    MachineEditing.prototype.popularNovels = function (page) {
        return __awaiter(this, void 0, void 0, function () {
            var feed, entries;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (page !== 1)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, this.feed('Series')];
                    case 1:
                        feed = _a.sent();
                        entries = feed.entry || [];
                        if (entries.length !== Number(feed.openSearch$totalResults.$t))
                            throw new Error('Machine Editing: the series list is incomplete.');
                        return [2 /*return*/, entries.map(function (entry) { return _this.project(entry); })];
                }
            });
        });
    };
    MachineEditing.prototype.parseNovel = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            var $, _a, label, first, total, start, chapters, seen, feed, _b, entries, _i, entries_1, entry, href, chapterPath, number, field, name;
            var _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _a = cheerio_1.load;
                        return [4 /*yield*/, this.request(this.resolveUrl(path))];
                    case 1: return [4 /*yield*/, (_e.sent()).text()];
                    case 2:
                        $ = _a.apply(void 0, [_e.sent()]);
                        label = (_c = /clwd\.run\(\s*['"]([^'"]+)['"]\s*\)/.exec($('#clwd').html() || '')) === null || _c === void 0 ? void 0 : _c[1];
                        if (!label)
                            throw new Error('Machine Editing: the novel chapter label could not be read.');
                        return [4 /*yield*/, this.feed(label, 1, true)];
                    case 3:
                        first = _e.sent();
                        total = Number(first.openSearch$totalResults.$t);
                        if (total < 1 || total > 15000)
                            throw new Error('Machine Editing: invalid chapter count.');
                        start = 1;
                        chapters = [];
                        seen = {};
                        _e.label = 4;
                    case 4:
                        if (!(start <= total)) return [3 /*break*/, 8];
                        if (!(start === 1)) return [3 /*break*/, 5];
                        _b = first;
                        return [3 /*break*/, 7];
                    case 5: return [4 /*yield*/, this.feed(label, start, true)];
                    case 6:
                        _b = _e.sent();
                        _e.label = 7;
                    case 7:
                        feed = _b;
                        entries = feed.entry || [];
                        if (Number(feed.openSearch$totalResults.$t) !== total || !entries.length)
                            throw new Error('Machine Editing: the chapter feed changed. Refresh to retry.');
                        for (_i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
                            entry = entries_1[_i];
                            href = (_d = entry.link.find(function (link) { return link.rel === 'alternate'; })) === null || _d === void 0 ? void 0 : _d.href;
                            if (!href)
                                throw new Error('Machine Editing: a chapter address is missing.');
                            chapterPath = new URL(this.resolveUrl(href)).pathname;
                            if (seen[chapterPath])
                                throw new Error('Machine Editing: repeated feed page.');
                            seen[chapterPath] = true;
                            number = /(?:chapter|episode)\s+(\d+(?:\.\d+)?)/i.exec(entry.title.$t);
                            if (!number && !/prologue|epilogue|side story/i.test(entry.title.$t))
                                continue;
                            chapters.push({
                                name: entry.title.$t,
                                path: chapterPath,
                                chapterNumber: number ? Number(number[1]) : undefined,
                                releaseTime: entry.published.$t,
                            });
                        }
                        start += entries.length;
                        return [3 /*break*/, 4];
                    case 8:
                        if (!chapters.length)
                            throw new Error('Machine Editing: no chapter entries were found.');
                        chapters.sort(function (a, b) {
                            if (a.chapterNumber !== undefined && b.chapterNumber !== undefined)
                                return a.chapterNumber - b.chapterNumber;
                            return (a.releaseTime || '').localeCompare(b.releaseTime || '');
                        });
                        field = function (label) {
                            return $('#extra-info dt')
                                .filter(function (_, element) { return $(element).text().trim() === label; })
                                .first()
                                .next('dd')
                                .text()
                                .trim() || undefined;
                        };
                        name = $('meta[property="og:title"]').attr('content') ||
                            $('h1').first().text().trim();
                        return [2 /*return*/, {
                                name: name,
                                path: path,
                                cover: $('article img').first().attr('src') || defaultCover_1.defaultCover,
                                summary: $('#synopsis').text().trim(),
                                author: field('Author'),
                                genres: field('Tags'),
                                status: field('Chapter'),
                                chapters: chapters,
                            }];
                }
            });
        });
    };
    MachineEditing.prototype.parseChapter = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            var $, _a, body;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = cheerio_1.load;
                        return [4 /*yield*/, this.request(this.resolveUrl(path))];
                    case 1: return [4 /*yield*/, (_b.sent()).text()];
                    case 2:
                        $ = _a.apply(void 0, [_b.sent()]);
                        body = $('article.txt').first();
                        if ($('#clwd', body).length)
                            throw new Error('Machine Editing: this is a series page, not a chapter.');
                        body.find('script,style,iframe,form,.adsbygoogle,.separator').remove();
                        body.find('[style]').removeAttr('style');
                        body.find('div,p').each(function (_, element) {
                            if (/^Consider supporting me by subscribing/i.test($(element).text().trim()))
                                $(element).remove();
                        });
                        if (body.text().trim().length < 200)
                            throw new Error('Machine Editing: no readable public chapter was found.');
                        return [2 /*return*/, body.html()];
                }
            });
        });
    };
    MachineEditing.prototype.searchNovels = function (term, page) {
        return __awaiter(this, void 0, void 0, function () {
            var query;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = term.trim().toLowerCase();
                        return [4 /*yield*/, this.popularNovels(page)];
                    case 1: return [2 /*return*/, (_a.sent()).filter(function (novel) {
                            return novel.name.toLowerCase().includes(query);
                        })];
                }
            });
        });
    };
    MachineEditing.prototype.resolveUrl = function (path) {
        var url = new URL(path, this.site);
        if (url.origin !== this.site)
            throw new Error('Machine Editing: invalid page address.');
        return url.href;
    };
    return MachineEditing;
}());
exports.default = new MachineEditing();
