# NovTales for LNReader

The stock-app source remains version 1.0.3. Its direct page requests currently encounter NovTales browser verification, and complete chapter reading has not been verified in stock LNReader.

## Browser reader preview (1.1.0)

A separate **LNReader NovTales** Android preview adds a visible website browser. NovTales loads a chapter through its normal reader; after the correct chapter end marker appears, LNReader opens the complete text. See [installation instructions and current evidence](NOVTALES-BROWSER.md).

The preview APK is built by [Build NovTales Browser Reader](https://github.com/Sadloif/lnreader-novtales/actions/workflows/build-novtales-browser.yml). Android operation still needs verification on a real phone. The companion repository is:

```text
https://raw.githubusercontent.com/Sadloif/lnreader-novtales/main/browser-plugins.min.json
```

Public chapters do not necessarily require sign-in. A complete public Chapter 1 loaded in Brave while signed out. Paid chapters still require valid website access. Browser verification and membership are separate conditions.

## Stock-app repository

Add this repository URL to LNReader, refresh the source list, then install **NovTales**:

```text
https://raw.githubusercontent.com/Sadloif/lnreader-novtales/main/plugins.min.json
```

Keep the official LNReader plugin repository enabled alongside this one. The browser preview requires its separate app and companion repository above.

## Features

- Popular titles and latest arrivals.
- Search by title and alternative title.
- Novel descriptions, author, covers, genres, status and rating.
- Chapter pages ordered from oldest to newest, including decimal chapters.
- Clean chapter HTML with formatting preserved when a complete chapter is delivered.
- Protected delivery flags are distinct from paid membership access. A preview alone is not accepted as a complete chapter.

## Files

- `plugins.min.json`: the stock-app repository list.
- `novtales.js`: the compiled stock-app source.
- `novtales.ts`: TypeScript source for maintenance.
- `browser-plugins.min.json`: the browser preview companion repository.
- `novtales-browser.js` and `novtales-browser.ts`: browser companion source version 1.1.0.
- `novtales-browser.patch`: app integration patch for LNReader 2.1.4.
- `NOVTALES-BROWSER.md`: preview installation instructions and verification limits.
- `icon.png`: a 96px version of NovTales' existing logo.
- `gate-watch.cjs`: polls NovTales and reports its current reachability state.
- `findings.md`: earlier validation evidence and reproduction instructions.

To edit and rebuild the source, use the [LNReader plugin development repository](https://github.com/lnreader/lnreader-plugins), placing the TypeScript source in `plugins/english/` and the icon in `public/static/src/en/novtales/`. Follow its build and testing instructions. Increment the source and manifest version when updating.

## Validation and error attribution

Earlier parser checks covered catalogue entries, novel metadata, chapter pagination, decimal chapters, ordering and content cleanup. Current command-line live checks encounter HTTP 429 browser verification; they do not prove Android chapter delivery.

The browser preview passes TypeScript, lint and 13 focused app tests, plus compiled-plugin checks. A complete public chapter loaded in Brave without signing in. Real Android WebView operation remains unverified.

**The old TLS explanation was plugin-defined.** The website returned HTTP 429 with Vercel browser-verification markers. Our plugin added the assertion that every non-browser client was rejected at the TLS handshake. That assertion was not established by the response and has been removed from the browser companion source.

The earlier blanket statement that chapter text is available only to signed-in members was also incorrect. Public browser reading demonstrated otherwise.

## Version 1.0.3

Rate-limiting responses are retried twice with a short backoff. These retries do not establish that website browser verification can be resolved by an ordinary page request.

## Version 1.0.1

Included the device's cookies explicitly in page requests and avoided LNReader's synthetic request headers while retaining the app's WebView user agent.

---

This plugin was developed with assistance from OpenAI Codex and DeepSeek Harness. It is an independent source plugin and is not affiliated with NovTales or the LNReader project.
