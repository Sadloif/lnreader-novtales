"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var Maehwasup = /** @class */ (function () {
    function Maehwasup() {
        this.id = 'maehwasup';
        this.name = 'Maehwasup';
        this.site = 'https://maehwasup.com';
        this.icon = 'src/en/maehwasup/icon.png';
        this.version = '1.0.0';
    }
    Maehwasup.prototype.request = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, fetch_1.fetchApi)(url)];
                    case 1:
                        response = _a.sent();
                        if (!response.ok)
                            throw Object.assign(new Error("Maehwasup: HTTP ".concat(response.status, ".")), {
                                status: response.status,
                            });
                        return [2 /*return*/, response];
                }
            });
        });
    };
    Maehwasup.prototype.popularNovels = function (page) {
        return __awaiter(this, void 0, void 0, function () {
            var $, _a, name;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (page !== 1)
                            return [2 /*return*/, []];
                        _a = cheerio_1.load;
                        return [4 /*yield*/, this.request(this.site)];
                    case 1: return [4 /*yield*/, (_b.sent()).text()];
                    case 2:
                        $ = _a.apply(void 0, [_b.sent()]);
                        name = $('.wp-block-site-title').first().text().trim();
                        if (!name)
                            throw new Error('Maehwasup: the novel title could not be read.');
                        return [2 /*return*/, [{ name: name, path: '/', cover: defaultCover_1.defaultCover }]];
                }
            });
        });
    };
    Maehwasup.prototype.index = function (page) {
        return __awaiter(this, void 0, void 0, function () {
            var url, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = 'https://public-api.wordpress.com/rest/v1.1/sites/maehwasup.com/posts/' +
                            "?number=100&page=".concat(page, "&order=ASC&order_by=date&fields=URL,title,date");
                        return [4 /*yield*/, this.request(url)];
                    case 1: return [4 /*yield*/, (_a.sent()).json()];
                    case 2:
                        data = _a.sent();
                        if (!Number.isInteger(data.found) ||
                            data.found < 0 ||
                            !Array.isArray(data.posts))
                            throw new Error('Maehwasup: the public chapter index could not be read.');
                        return [2 /*return*/, data];
                }
            });
        });
    };
    Maehwasup.prototype.parseNovel = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            var novel, first, pages, chapters, seen, received, page, data, _a, _i, _b, post, name_1, url, number;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.popularNovels(1)];
                    case 1:
                        novel = (_c.sent())[0];
                        return [4 /*yield*/, this.index(1)];
                    case 2:
                        first = _c.sent();
                        pages = Math.ceil(first.found / 100);
                        if (pages > 100)
                            throw new Error('Maehwasup: the index is unexpectedly large.');
                        chapters = [];
                        seen = {};
                        received = 0;
                        page = 1;
                        _c.label = 3;
                    case 3:
                        if (!(page <= pages)) return [3 /*break*/, 8];
                        if (!(page === 1)) return [3 /*break*/, 4];
                        _a = first;
                        return [3 /*break*/, 6];
                    case 4: return [4 /*yield*/, this.index(page)];
                    case 5:
                        _a = _c.sent();
                        _c.label = 6;
                    case 6:
                        data = _a;
                        if (data.found !== first.found || !data.posts.length)
                            throw new Error('Maehwasup: the index changed. Refresh the novel to retry.');
                        received += data.posts.length;
                        for (_i = 0, _b = data.posts; _i < _b.length; _i++) {
                            post = _b[_i];
                            name_1 = (0, cheerio_1.load)(post.title).text().trim();
                            if (!/chapter|side story|spinoff|prologue|epilogue/i.test(name_1))
                                continue;
                            url = new URL(post.URL);
                            if (url.origin !== this.site || seen[url.pathname])
                                throw new Error('Maehwasup: an invalid or repeated chapter was returned.');
                            seen[url.pathname] = true;
                            number = /^Chapter\s+(\d+(?:\.\d+)?)/i.exec(name_1);
                            chapters.push({
                                name: name_1,
                                path: url.pathname,
                                releaseTime: post.date,
                                chapterNumber: number ? Number(number[1]) : undefined,
                            });
                        }
                        _c.label = 7;
                    case 7:
                        page++;
                        return [3 /*break*/, 3];
                    case 8:
                        if (received !== first.found || !chapters.length)
                            throw new Error('Maehwasup: the chapter list is incomplete. Refresh to retry.');
                        return [2 /*return*/, __assign(__assign({}, novel), { path: path, chapters: chapters })];
                }
            });
        });
    };
    Maehwasup.prototype.parseChapter = function (path) {
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
                        body = $('.entry-content.wp-block-post-content').first();
                        body.find('script,style,iframe,.wordads-tag,.sharedaddy,form').remove();
                        body.find('p').each(function (_, element) {
                            if (/^(Please,?\s+subscribe\/donate|ROTMHS Glossary)/i.test($(element).text().trim()))
                                $(element).remove();
                        });
                        if (body.text().trim().length < 200)
                            throw new Error('Maehwasup: no readable public chapter was found.');
                        return [2 /*return*/, body.html()];
                }
            });
        });
    };
    Maehwasup.prototype.searchNovels = function (term, page) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.popularNovels(page)];
                    case 1: return [2 /*return*/, (_a.sent()).filter(function (novel) {
                            return novel.name.toLowerCase().includes(term.trim().toLowerCase());
                        })];
                }
            });
        });
    };
    Maehwasup.prototype.resolveUrl = function (path) {
        var url = new URL(path, this.site);
        if (url.origin !== this.site)
            throw new Error('Maehwasup: invalid page address.');
        return url.href;
    };
    return Maehwasup;
}());
exports.default = new Maehwasup();
