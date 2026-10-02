# NovTales plugin — root cause found and proven

Status: **resolved as "cannot be fixed from inside LNReader"**. The plugin's code and
parsers are correct; the blocker is a transport-level bot gate that no plugin code
can influence.

The blocking condition was re-observed on three consecutive rounds — **2026-10-02 12:44,
12:46 and 12:47 (+05:00)** — with identical results each time (real Chrome 200; Node 429
challenge on every path, including `robots.txt`). The goal was closed as **blocked** on
that evidence.

Release: **v1.0.2** published to `Sadloif/lnreader-novtales` (commit `34df63b`), verified
end-to-end — manifest, compiled plugin, source, icon and advertised URLs all correct.

Supersedes the open questions in [investigation.md](./investigation.md).

---

## 1. The answer in one paragraph

`novtales.com` sits behind **Vercel's Security Checkpoint**, which here admits only
clients whose **TLS handshake looks like a real browser**. LNReader plugin requests go
through React Native's `fetch` → OkHttp on Android, whose TLS ClientHello is not
Chrome's, so *every* request is answered with `HTTP 429` +
`x-vercel-mitigated: challenge`. This is not a rate limit, not a missing header, not a
missing cookie, and not something a visit to the app's WebView can influence. The
WebView itself works precisely because it *is* a real browser engine.

---

## 2. The decisive experiment

Four requests, same URL (`https://novtales.com/explore`), same machine, same IP,
run minutes apart. Script: [`probe/fingerprint.cjs`](./probe/fingerprint.cjs).

| # | Client | Headers | HTTP version | Result |
|---|--------|---------|--------------|--------|
| T1 | Node `fetch` | minimal | HTTP/1.1 | **429** challenge |
| T2 | Node `fetch` | *complete Chrome set* (`sec-ch-ua`, `sec-fetch-*`, `Upgrade-Insecure-Requests`, `priority`, Chrome UA, `Accept-Encoding: gzip, deflate, br, zstd`) | HTTP/1.1 | **429** challenge |
| T3 | Node `http2` | same complete Chrome set | **HTTP/2** | **429** challenge |
| T4 | real Chrome 154, `--disable-http2` | browser's own | **HTTP/1.1** | **200 OK**, real page |

T2 vs T4 is the controlled comparison: **identical header set, identical HTTP version,
identical IP — Node is challenged, Chrome is not.** The only remaining variable is the
TLS ClientHello. (Chrome was additionally forced to HTTP/1.1 to remove HTTP/2/ALPN as a
confounder; the negotiated protocol was confirmed as `http/1.1`.)

So: it is not the headers, and it is not the HTTP version. It is the TLS fingerprint.

### The cookie hypothesis is dead

The same run captured the browser's full cookie jar after it had loaded the site:
**`Network.getAllCookies` → `[]`. Zero cookies.**

Chrome passed the checkpoint on its **first** request, with no prior state, and set no
cookie. There is therefore **no verified session to reuse**. The published plugin's
error text — *"Open Explore in the source WebView, then return and retry"* — describes a
mechanism that does not exist. That instruction was followed during the original
investigation and could never have worked.

### It is not path-scoped either

Every path probed from a non-browser client is challenged, including paths that carry no
content at all:

```
/  /explore  /robots.txt  /sitemap.xml  /rss  /feed  /manifest.json
/favicon.ico  /icon.png  /_next/static/chunks/main.js
/novel/<slug>  /chapter/<slug>-1
/api/public/novel-chapters/<slug>  /api/public/chapter-grant
```

The earlier note that "public chapter RSS feeds return HTTP 200" does not reproduce from
this machine. Nothing served by the Vercel edge is reachable by a non-browser client.

### Limits of this evidence

The controlled comparison ran from a single network, so it proves what the gate does
*here*. Vercel may combine fingerprint and IP reputation, so another network could in
principle be treated more leniently. That does not rescue the plugin: the user's own
device already received `x-vercel-mitigated: challenge` from its own network, so the
block is not an artefact of this test machine.

---

## 3. Why the phone behaves exactly this way

| | Android client | TLS stack | Checkpoint |
|---|---|---|---|
| LNReader source WebView | `android.webkit.WebView` | BoringSSL (Chrome's stack) | **passes** |
| LNReader plugin `fetchApi` | OkHttp via RN | platform/Conscrypt provider | **429** |

This matches every observation in the original report: the chapter renders in the
WebView, and the plugin still gets 429 afterwards.

I verified in the RN 0.86 sources that plugin cookies are *not* the problem — RN does
forward them both ways:

- `OkHttpClientProvider.kt` builds every client with `.cookieJar(ReactCookieJarContainer())`
- `ForwardingCookieHandler.kt` — *"Cookie handler that forwards all cookies to the WebView
  CookieManager"* — reads via `CookieManager.getCookie(uri)` and writes via `setCookie`

That bridge is real, and it is irrelevant here, because the checkpoint issues no cookie
to forward.

---

## 4. Second, independent blocker: there is no anonymous chapter text

Even if transport were solved, the plugin could not deliver chapters. Measured with the
browser that *does* pass the checkpoint
([`probe/network-log.cjs`](./probe/network-log.cjs), [`probe/dump-html.cjs`](./probe/dump-html.cjs)):

- `POST /api/public/chapter-grant` → **401** for an anonymous visitor
  (body: `{"slug":"…","number":1,"deviceId":"…","v":"…"}`)
- the chapter page's server HTML contains `<div class="nv-chapter-body …"></div>` —
  **empty**, followed by a `<section aria-label="Loading chapter">` placeholder
- the rendered page reads **"Protected reading is paused — Sign in"**
- `.nv-chapter-body` inner text length: **0**; zero `<p>` elements

Chapter text is fetched client-side only after the grant succeeds, and the site is
currently telling anonymous visitors that protected reading is paused. A scraping plugin
would return an empty chapter body even with the gate out of the way.

---

## 5. What is *not* broken: the plugin's own parsing

To separate "parsing is wrong" from "transport is blocked", I captured the live HTML
using the passing browser as transport ([`probe/dump-html.cjs`](./probe/dump-html.cjs))
and ran the plugin's real `readPageData` against it
([`probe/verify-parsers.cjs`](./probe/verify-parsers.cjs)):

| Check | Result |
|---|---|
| `/explore` → `readPageData(html, 'catalogue')` | **212 entries**, all with `slug` + `title`, 204 with `hearts`, 212 with `added` |
| `/novel/<slug>` → `readPageData(html, 'novel')` | title, author `Jung Yoon Kang`, status `HIATUS`, `ratingAverage` 5, 3 genres, synopsis 570 chars, cover URL, `chapterTotalPages` **81** |
| chapter list | 12 per page, `locked` flags present (9 locked), decimal numbers preserved (`944.5`, `943.5`) |
| `?chapters=1` pagination | newest-first page 1, numbers 944.5 → 936 |
| `/chapter/<slug>-1` selectors | `.nv-chapter-body` present (but empty — see §4) |

The parser, pagination mapping, status mapping and metadata extraction are all still
correct against the live site. **Transport is the only thing standing between this plugin
and a working implementation.**

---

## 6. What would make it work again

Any one of these:

1. **NovTales disables or narrows the Vercel checkpoint** (e.g. exempts `/api/public/*`,
   or turns off Attack-Challenge-style enforcement). The current plugin would start
   working with no code change beyond what §7 ships.
2. **NovTales grants access** — an official plugin, an API key, or a documented public
   read endpoint. This is the only route that is both reliable and permitted.
3. **NovTales fixes anonymous chapter delivery.** Today `chapter-grant` 401s for signed-out
   visitors, so even a pass-through yields metadata and chapter lists only.

### 6.1 No alternative data path exists (verified 2026-10-02, re-confirmed after release)

The objective allowed for "a genuinely equivalent data path" — i.e. reading NovTales
content from somewhere other than the blocked Vercel edge. That branch is now closed with
evidence, not assumption ([`probe/close-datapath.cjs`](./probe/close-datapath.cjs)):

| Question | Evidence |
|---|---|
| Does the site's *own browser client* read content from any non-Vercel host? | **No.** Across Explore, a novel page and a chapter page, all **167** requests went to `novtales.com`. Zero direct `supabase.co` content requests. |
| Is there any reachable non-edge host at all? | Only the public Supabase **storage** bucket (`/storage/v1/object/public/novel-images/…` → HTTP 200). Covers only — no text, no metadata, no chapter lists. |
| Is there a public Supabase data API? | `https://llcuhbcnkkcezqnibwmw.supabase.co/rest/v1/` → **401 `No API key found in request`**. No content key is exposed in the captured HTML, and the site's client never queries content tables. |

Even the covers are served to the app through the gated edge
(`novtales.com/_next/image?url=…supabase.co…`) — 19 of them on the Explore page alone.

Harvesting a key to enumerate tables was deliberately not attempted: the prior
investigation already recorded `401 Secret API key required` on that route, the site's own
client demonstrates no such API is in use, and chapter text is membership-gated regardless
(§4) — so reading it from a table would be circumventing paid access, not reading a public
API.

**Conclusion:** every content request must cross the TLS-gated Vercel edge. There is no
second door.

---

### 6.2 The gate has not narrowed — per-path matrix (2026-10-02 12:46)

The most plausible way this plugin becomes usable again is NovTales narrowing the rule —
above all by exempting `/api/public/*`. That would leave an HTML-scraping plugin broken
while an API-based one worked, so it is worth detecting directly rather than assuming.

[`probe/path-matrix.cjs`](./probe/path-matrix.cjs) requests each path twice: from Node
(the plugin's transport) and from inside a real browser (the baseline for what the path
actually returns).

| kind | path | browser | node |
|---|---|---|---|
| html | `/explore` | 200 `text/html` | **429 challenge** |
| html | `/novel/<slug>` | 200 `text/html` | **429 challenge** |
| html | `/chapter/<slug>-1` | 200 `text/html` | **429 challenge** |
| api | `/api/public/site-settings` | 200 `application/json` | **429 challenge** |
| api | `/api/public/trending` | 200 `application/json` | **429 challenge** |
| api | `/api/public/novel-chapters/<slug>` (+ paged variant) | 200 `application/json` | **429 challenge** |
| api | `/api/public/recommendations` | 200 `application/json` | **429 challenge** |
| api | `/api/public/conversations` | 200 `application/json` | **429 challenge** |
| api | `/api/public/novel-engagement` | 400 (POST-only) | **429 challenge** |
| feed | `/rss` | **404** | **429 challenge** |
| static | `/robots.txt` | 200 `text/plain` | **429 challenge** |

**No path is exempt.** Even `robots.txt` — a static text file — is challenged. There is
nothing to rewrite the plugin onto, and an API-first implementation would not help anyway:
the catalogue only exists in the server-rendered `/explore` payload, so HTML access is
required regardless.

> **Correction to the original investigation:** it recorded that "public chapter RSS feeds
> return HTTP 200". That does not reproduce — `/rss` returns **404** to a browser. The RSS
> avenue was never real, and it would not have supplied chapter text in any case.

---

## 7. What was deliberately *not* done

The only technically viable way to make automated requests pass is **TLS-impersonation**
(a client that reproduces Chrome's ClientHello — `curl-impersonate`, uTLS, or a proxy
built on them). I did not implement it, and it should not go into a published plugin:

- it is deliberate circumvention of a bot-protection control the site turned on;
- the site explicitly warns about automated reading tools and states that protected
  reading can be suspended — the account risk lands on the user, not the plugin;
- the payoff is small (§4: no chapter text for anonymous visitors anyway) and the
  approach breaks the moment Vercel tightens the rule.

Nothing in this investigation extracted browser session cookies, private storage, or
account credentials. The browser runs in §2 used a throwaway profile and visited only
public pages.

---

## 8. Reproduction

The ongoing check ships with the plugin repository as `gate-watch.cjs`:

```sh
node gate-watch.cjs --once     # exit 0 = gate open, 1 = still blocked, 2 = network error
```

The one-off probes behind §2, §5 and §6 live in `probe/` in the development workspace and
are not published with the plugin. Each takes the path to a Chrome or Edge executable as
its first argument:

```sh
node probe/fingerprint.cjs   "$CHROME"  https://novtales.com/explore   # §2: decisive T1–T4 experiment
node probe/cdp-challenge.cjs "$CHROME"  https://novtales.com/explore   # §2: browser cookie jar + non-browser replay
node probe/network-log.cjs   "$CHROME"                                    # §3/§6.1: every request the site's own client makes
node probe/dump-html.cjs     "$CHROME"                                    # §5: capture the live HTML through the browser
node probe/verify-parsers.cjs                                             # §5: run the plugin's own parsers over that HTML
node probe/path-matrix.cjs   "$CHROME"                                    # §6.2: per-path exemption matrix
node probe/close-datapath.cjs                                             # §6.1: alternative-data-path closure
node probe/member-export-check.cjs "$CHROME"                              # §6: official offline/export feature scan
```

Artifacts written next to the probes: `probe/cookies.json`, `probe/network-log.json`,
`probe/path-matrix.json`, `probe/live/*.html`.

## 9. References

- RN cookie bridge: [`OkHttpClientProvider.kt`](https://github.com/facebook/react-native/blob/v0.86.0/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/modules/network/OkHttpClientProvider.kt), [`ForwardingCookieHandler.kt`](https://github.com/facebook/react-native/blob/v0.86.0/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/modules/network/ForwardingCookieHandler.kt)
- LNReader v2.1.4 plugin fetch: `src/plugins/helpers/fetch.ts` in the LNReader app source (plain RN `fetch`, no cookie API)
- LNReader v2.1.4 source WebView: `src/screens/WebviewScreen/WebviewScreen.tsx` in the LNReader app source
- Live site: <https://novtales.com/explore>
