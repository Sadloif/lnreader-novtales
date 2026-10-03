# NovTales plugin — source validation

Status: **the plugin's parsers are correct.** Catalogue, metadata, pagination and
chapter-list parsing were verified against live NovTales data on 2026-10-02.

Release: **v1.0.3**, published to `Sadloif/lnreader-novtales`.

Supersedes the open questions in [investigation.md](./investigation.md).

---

## 1. What was verified

The plugin was validated against live NovTales HTML and JSON captured on 2026-10-02.
Live data was captured through a development-machine browser; the plugin's own runtime
transport was not exercised as part of this validation.

---

## 2. Parser verification

Captured live HTML was run through the plugin's real `readPageData`
([`probe/verify-parsers.cjs`](./probe/verify-parsers.cjs)):

| Check | Result |
|---|---|
| `/explore` → `readPageData(html, 'catalogue')` | **212 entries**, all with `slug` + `title`, 204 with `hearts`, 212 with `added` |
| `/novel/<slug>` → `readPageData(html, 'novel')` | title, author `Jung Yoon Kang`, status `HIATUS`, `ratingAverage` 5, 3 genres, synopsis 570 chars, cover URL, `chapterTotalPages` **81** |
| chapter list | 12 per page, `locked` flags present (9 locked), decimal numbers preserved (`944.5`, `943.5`) |
| `?chapters=1` pagination | newest-first page 1, numbers 944.5 → 936 |
| `/chapter/<slug>-1` selectors | `.nv-chapter-body` present (but empty — see §3) |

The parser, pagination mapping, status mapping and metadata extraction are all correct
against the live site.

---

## 3. Observed site API

Captured from the site's own client
([`probe/network-log.cjs`](./probe/network-log.cjs)):

| kind | path | response |
|---|---|---|
| html | `/explore` | 200 `text/html` |
| html | `/novel/<slug>` | 200 `text/html` |
| html | `/chapter/<slug>-1` | 200 `text/html` |
| api | `/api/public/site-settings` | 200 `application/json` |
| api | `/api/public/trending` | 200 `application/json` |
| api | `/api/public/novel-chapters/<slug>` (+ paged variant) | 200 `application/json` |
| api | `/api/public/recommendations` | 200 `application/json` |
| api | `/api/public/conversations` | 200 `application/json` |
| api | `/api/public/novel-engagement` | 400 (POST-only) |
| feed | `/rss` | 404 |

The catalogue itself only exists inside the server-rendered `/explore` payload, so an
implementation needs HTML access in addition to the JSON endpoints.

**Chapter delivery flow.** A successful `POST /api/public/chapter-grant` returns a grant
token and an `initialBlock` containing paragraphs, `nextCursor` and `complete`. Further
text arrives from `POST /api/public/chapter-body` using grant and cursor headers.
Chapter lists use `GET /api/public/novel-chapters/{slug}` with `page`, `pageSize`,
optional `q`/`anchor`, and optional `order`. Device registration uses
`POST /api/public/me/device`.

**Chapter availability.** `POST /api/public/chapter-grant` returns 401 to a signed-out
visitor. The served chapter HTML carries an empty `.nv-chapter-body` followed by a
`Loading chapter` placeholder, and the rendered page reads *"Protected reading is paused
— Sign in"*; the measured inner-text length of `.nv-chapter-body` is 0 with zero `<p>`
elements. Chapter text is fetched client-side only once a grant succeeds, so a
signed-out reader receives metadata and chapter lists only. Members-only and locked
chapters remain subject to the site's membership requirements.

**Authentication.** The site's `authedFetch` helper reads the current Supabase session
access token from `document.cookie` (auth storage key
`sb-llcuhbcnkkcezqnibwmw-auth-token`, project `llcuhbcnkkcezqnibwmw`), adds
`Authorization: Bearer <access token>` when signed in, and adds a UUID in
`x-novtales-request-id`. It retries once after a 401 only if Supabase supplies a
different refreshed token.

---

## 4. Data paths

[`probe/close-datapath.cjs`](./probe/close-datapath.cjs) established that all content
requests go to `novtales.com`. Across Explore, a novel page and a chapter page, all
**167** observed requests targeted `novtales.com`, with zero direct `supabase.co`
content requests.

The public Supabase **storage** bucket is reachable
(`/storage/v1/object/public/novel-images/…` → HTTP 200) but covers only images — no
text, no metadata, no chapter lists. Covers reach the app through
`novtales.com/_next/image?url=…supabase.co…`, 19 of them on the Explore page alone.

No public Supabase **data** API is available either:
`https://llcuhbcnkkcezqnibwmw.supabase.co/rest/v1/` returns 401 `No API key found in
request`. No content key is exposed in the captured HTML, and the site's own client
never queries content tables.

Harvesting a key to enumerate tables was deliberately not attempted: chapter text is
membership-gated, so reading it from a table would be circumventing paid access rather
than reading a public API. The prior investigation recorded `401 Secret API key
required` on the same route.

---

## 5. Official access

Where a chapter cannot be delivered directly, the supported route is official access: an
official plugin, an API key, or a documented public read endpoint. This is the only route
that is both reliable and permitted. A draft message making that request — including an
offline/export question — is prepared in `novtales-outreach.md`.

---

## 6. Reproduction

A reachability check ships with the plugin repository as `gate-watch.cjs`:

```sh
node gate-watch.cjs --once
```

The one-off probes behind the sections above live in `probe/` in the development
workspace and are not published with the plugin. Each takes the path to a Chrome or
Edge executable as its first argument where noted:

```sh
node probe/verify-parsers.cjs                                             # §2: run the plugin's own parsers over live HTML
node probe/network-log.cjs   "$CHROME"                                    # §3: every request the site's own client makes
node probe/close-datapath.cjs                                             # §4: data-path closure
node probe/member-export-check.cjs "$CHROME"                              # §5: official offline/export feature scan
```

Artifacts written next to the probes: `probe/cookies.json`, `probe/network-log.json`,
`probe/live/*.html`.

---

## 7. References

- LNReader v2.1.4 plugin fetch: `src/plugins/helpers/fetch.ts` in the LNReader app source
- LNReader v2.1.4 source WebView: `src/screens/WebviewScreen/WebviewScreen.tsx` in the LNReader app source
- Live site: <https://novtales.com/explore>