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
function sanitizeChapter(html, base) {
    var $ = (0, cheerio_1.load)(html, null, false);
    $('script,style,iframe,object,embed,svg,math,form,template,noscript').remove();
    var tags = 'p,div,span,h1,h2,h3,h4,h5,h6,br,hr,strong,em,b,i,u,s,del,small,sub,sup,blockquote,pre,code,ul,ol,li,table,thead,tbody,tfoot,tr,th,td,a,img,ruby,rt,rp'.split(',');
    $('*').each(function (_, element) {
        var _a;
        var node = $(element);
        var tag = ((_a = node.prop('tagName')) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || '';
        if (!tags.includes(tag)) {
            node.replaceWith(node.contents());
            return;
        }
        var allowed = ['title'];
        if (tag === 'a')
            allowed.push('href');
        if (tag === 'img')
            allowed.push('src', 'alt');
        for (var _i = 0, _b = Object.keys(node.attr() || {}); _i < _b.length; _i++) {
            var attribute_1 = _b[_i];
            if (!allowed.includes(attribute_1))
                node.removeAttr(attribute_1);
        }
        var attribute = tag === 'a' ? 'href' : tag === 'img' ? 'src' : undefined;
        if (attribute && node.attr(attribute)) {
            try {
                var url = new URL(node.attr(attribute), base);
                if (url.protocol !== 'https:' && url.protocol !== 'http:')
                    node.removeAttr(attribute);
                else
                    node.attr(attribute, url.href);
            }
            catch (_c) {
                node.removeAttr(attribute);
            }
        }
    });
    return $.root().html() || '';
}
var HenNovelTranslations = /** @class */ (function () {
    function HenNovelTranslations() {
        this.id = 'hennoveltranslations';
        this.name = 'Hen Novel Translations';
        this.site = 'https://hennoveltranslations.org';
        this.icon = 'src/en/hennoveltranslations/icon.png';
        this.version = '1.0.1';
    }
    HenNovelTranslations.prototype.html = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, fetch_1.fetchApi)(this.resolveUrl(path))];
                    case 1:
                        response = _a.sent();
                        if (!response.ok)
                            throw Object.assign(new Error("Hen Novel Translations: HTTP ".concat(response.status, ".")), {
                                status: response.status,
                            });
                        return [2 /*return*/, response.text()];
                }
            });
        });
    };
    HenNovelTranslations.prototype.document = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = cheerio_1.load;
                        return [4 /*yield*/, this.html(path)];
                    case 1: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
                }
            });
        });
    };
    HenNovelTranslations.prototype.popularNovels = function (page) {
        return __awaiter(this, void 0, void 0, function () {
            var $, novels;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (page !== 1)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, this.document('/')];
                    case 1:
                        $ = _a.sent();
                        novels = [];
                        $('.book-item-feature').each(function (_, element) {
                            var card = $(element);
                            var title = card.find('.book-title a');
                            var href = title.attr('href');
                            if (!href || !title.text().trim())
                                return;
                            var image = card.find('img').first();
                            novels.push({
                                name: title.text().trim(),
                                path: new URL(_this.resolveUrl(href)).pathname,
                                cover: image.attr('data-src') || image.attr('src') || defaultCover_1.defaultCover,
                            });
                        });
                        if (!novels.length)
                            throw new Error('Hen Novel Translations: the project list could not be read.');
                        return [2 /*return*/, novels];
                }
            });
        });
    };
    HenNovelTranslations.prototype.parseNovel = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            var html, $, name, details, field, summary, chapters, seen, list, completeLists, rows, group, declaredTotal;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.html(path)];
                    case 1:
                        html = _a.sent();
                        $ = (0, cheerio_1.load)(html);
                        name = $('.single-novel-title h1').text().trim();
                        if (!name)
                            throw new Error('Hen Novel Translations: the novel could not be read.');
                        details = $('.custom-fields').first();
                        field = function (label) {
                            var paragraph = details
                                .find('p')
                                .filter(function (_, element) {
                                return $(element).find('strong').first().text().trim() === label;
                            })
                                .first()
                                .clone();
                            paragraph.find('strong').remove();
                            return paragraph.text().trim() || undefined;
                        };
                        summary = details.clone();
                        summary.find('h2,.alternate-chapters,p').remove();
                        chapters = [];
                        seen = {};
                        list = $('.episode-list2');
                        completeLists = html.match(/<ul\b[^>]*\bclass\s*=\s*(["'])[^"']*\bepisode-list2\b[^"']*\1[^>]*>[\s\S]*?<\/ul\s*>/gi);
                        rows = list.children('li');
                        group = list.closest('.episode-group');
                        if (list.length !== 1 ||
                            (completeLists === null || completeLists === void 0 ? void 0 : completeLists.length) !== 1 ||
                            !rows.length ||
                            list.find('li').length !== rows.length ||
                            list.find('a').length !== rows.length ||
                            group.find('.pagination,a[rel=next],.load-more,[data-next-page]').length)
                            throw new Error('Hen Novel Translations: the free chapter list is incomplete or has changed.');
                        declaredTotal = list.attr('data-total');
                        if (declaredTotal !== undefined && Number(declaredTotal) !== rows.length)
                            throw new Error('Hen Novel Translations: not all free chapters were returned.');
                        rows.each(function (_, element) {
                            var row = $(element);
                            var link = row.find('a[href]');
                            if (link.length !== 1 || !link.text().trim())
                                throw new Error('Hen Novel Translations: a free chapter link is missing.');
                            var url = new URL(_this.resolveUrl(link.attr('href')));
                            var postId = url.searchParams.get('p');
                            var chapterPath = url.pathname.startsWith('/episodes/')
                                ? url.pathname
                                : url.pathname === '/' &&
                                    url.searchParams.get('post_type') === 'episodes' &&
                                    postId &&
                                    /^\d+$/.test(postId) &&
                                    Number.isSafeInteger(Number(postId)) &&
                                    Number(postId) > 0
                                    ? "/?post_type=episodes&p=".concat(Number(postId))
                                    : undefined;
                            if (!chapterPath || seen[chapterPath])
                                throw new Error('Hen Novel Translations: an invalid or repeated free chapter was returned.');
                            seen[chapterPath] = true;
                            var title = link.text().trim();
                            var number = /(?:episode|chapter)\s+(\d+(?:\.\d+)?)/i.exec(title);
                            chapters.push({
                                name: title,
                                path: chapterPath,
                                chapterNumber: number ? Number(number[1]) : undefined,
                                releaseTime: row.find('time').attr('datetime'),
                            });
                        });
                        chapters.reverse();
                        if (chapters.length !== rows.length)
                            throw new Error('Hen Novel Translations: the free chapter list is incomplete.');
                        return [2 /*return*/, {
                                name: name,
                                path: path,
                                cover: $('.novel-content img').first().attr('src') || defaultCover_1.defaultCover,
                                summary: summary.text().trim(),
                                author: field('Author:'),
                                genres: field('Genre:'),
                                status: field('Light Novel Status(Korean):'),
                                chapters: chapters,
                            }];
                }
            });
        });
    };
    HenNovelTranslations.prototype.parseChapter = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            var $, body, chapter;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.document(path)];
                    case 1:
                        $ = _a.sent();
                        body = $('.episode-content').first();
                        if (body.find('input[type=password]').length ||
                            /^(?:This content is|Please log in|You must be logged)/i.test(body.text().trim()))
                            throw new Error('Hen Novel Translations: this chapter is not publicly readable.');
                        body
                            .find('script,style,iframe,form,button,.episode-navigation,.adsbygoogle')
                            .remove();
                        body.find('[style]').removeAttr('style');
                        chapter = sanitizeChapter(body.html() || '', this.resolveUrl(path));
                        if ((0, cheerio_1.load)(chapter).text().trim().length < 200)
                            throw new Error('Hen Novel Translations: no readable public chapter was found.');
                        return [2 /*return*/, chapter];
                }
            });
        });
    };
    HenNovelTranslations.prototype.searchNovels = function (term, page) {
        return __awaiter(this, void 0, void 0, function () {
            var query;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = term.trim().toLowerCase();
                        return [4 /*yield*/, this.popularNovels(page)];
                    case 1: return [2 /*return*/, (_a.sent()).filter(function (novel) {
                            return (novel.name + ' ' + novel.path.replace(/-/g, ' '))
                                .toLowerCase()
                                .includes(query);
                        })];
                }
            });
        });
    };
    HenNovelTranslations.prototype.resolveUrl = function (path) {
        var url = new URL(path, this.site);
        if (url.origin !== this.site)
            throw new Error('Hen Novel Translations: invalid page address.');
        return url.href;
    };
    return HenNovelTranslations;
}());
exports.default = new HenNovelTranslations();
