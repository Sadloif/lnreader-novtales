# NovTales for LNReader

Add this repository URL to LNReader, refresh the source list, then install **NovTales**:

```text
https://raw.githubusercontent.com/Sadloif/lnreader-novtales/main/plugins.min.json
```

Keep the official LNReader plugin repository enabled alongside this one.

> **⚠️ This source does not work, and cannot be made to work from inside LNReader.**
> NovTales blocks every non-browser client at the TLS layer. See
> [Status](#status-this-source-cannot-be-read-while-the-site-keeps-its-bot-check-on)
> below before installing.

## Features

- Popular titles and latest arrivals.
- Search by title and alternative title.
- Novel descriptions, author, covers, genres, status and rating.
- Chapter pages ordered from oldest to newest, including decimal chapters.
- Clean chapter HTML with formatting preserved.
- Members-only chapters marked with a lock. Locked previews report the website's membership requirement.

## Files

- `plugins.min.json`: the repository list read by LNReader.
- `novtales.js`: the compiled plugin downloaded by LNReader.
- `novtales.ts`: TypeScript source for maintenance.
- `icon.png`: a 96px version of NovTales' existing logo.
- `gate-watch.cjs`: polls NovTales and prints the moment the bot check lifts — the point at which this plugin starts working with no changes.
- `findings.md`: the full evidence behind the Status section, and how to reproduce it.

To edit and rebuild the source, use the [LNReader plugin development repository](https://github.com/lnreader/lnreader-plugins), placing `novtales.ts` in `plugins/english/` and the icon in `public/static/src/en/novtales/`. Follow its build and testing instructions. Publish the resulting JavaScript here and increment the version in both the source and manifest when updating.

## Status: this source cannot be read while the site keeps its bot check on

NovTales serves every page behind **Vercel's Security Checkpoint**, which only accepts
clients whose TLS handshake looks like a real browser. LNReader plugin requests go through
React Native's fetch (OkHttp on Android), which does not, so **every** request — pages,
JSON endpoints, even `robots.txt` — is answered with HTTP 429 and
`x-vercel-mitigated: challenge`.

Measured, not assumed:

- a real Chrome gets **200 OK** on its first request, **with an empty cookie jar** — the
  checkpoint hands out no session that a plugin could reuse;
- Node's fetch sending the *complete* Chrome header set still gets 429, over both
  HTTP/1.1 and HTTP/2;
- Chrome forced to HTTP/1.1, with those same headers, gets 200.

Same headers, same HTTP version, same network — the only remaining difference is the TLS
ClientHello. **No header, user agent, cookie or WebView visit can change this.** The
earlier advice to "open the source WebView and retry" described a mechanism that does not
exist; 1.0.2 removes it.

There is a second, independent blocker: chapter text is not public. `POST
/api/public/chapter-grant` returns 401 to signed-out visitors and the served
`.nv-chapter-body` element is empty, so even a client that passed the checkpoint would
receive metadata and chapter lists only.

Full evidence and reproduction scripts live in `novtales-validation/findings.md` in the
development workspace.

### When this plugin will work again

Its parsers are verified correct against the live site (212 catalogue entries, 81 chapter
pages, decimal and locked chapters), so it resumes working unchanged if NovTales narrows
or removes the checkpoint — for example by exempting `/api/public/*`. Until then it fails
fast with an accurate message instead of asking you to retry something futile.

`gate-watch.cjs` in this repository watches for exactly that moment:

```sh
node gate-watch.cjs            # check every 30 minutes
node gate-watch.cjs 5          # check every 5 minutes
node gate-watch.cjs --once     # single check; exit 0 means the gate is open
```

When it prints `GATE LIFTED`, refresh the NovTales source in LNReader — v1.0.2 starts
working immediately, with no update needed.

## Validation

Created October 2, 2026; re-investigated and corrected in 1.0.2. Strict TypeScript,
ESLint, Prettier and the plugin repository's `check:plugin` live check all pass — the live
check reports **INCONCLUSIVE (HTTP 429)**, which is the site's block, not a plugin defect.
Android operation was never verified and cannot be, for the reason above.

This plugin was developed with assistance from OpenAI Codex; the 1.0.2 investigation used
DeepSeek Harness. It is an independent source plugin and is not affiliated with NovTales
or the LNReader project.

## Version 1.0.2

Replaces the misleading "browser verification blocked this request … open Explore in the
source WebView, then return and retry" message with an accurate explanation of the TLS
fingerprint gate, and documents the root cause in the source so it is not re-investigated.
No parsing behaviour changed.

## Version 1.0.1

Included the device's cookies explicitly in page requests and avoided LNReader's synthetic
request headers while retaining the app's WebView user agent. That was a compatibility
attempt; it did not solve the block (see Status above).
