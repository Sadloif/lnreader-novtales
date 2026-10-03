# NovTales browser reader preview

This preview adds a visible website browser to LNReader 2.1.4. NovTales loads its pages and chapter text using its own normal reader. When the correct chapter's end marker appears, LNReader opens the complete text in its reader.

The companion source is version 1.1.0. It requires this reader build for browser loading. Stock LNReader does not provide the browser integration.

## Install and verify

1. Download the `LNReader-NovTales-browser` artifact from the successful GitHub Actions build. Extract it and install `LNReader-NovTales.apk` on an Android phone with an arm64 processor.
2. Open **LNReader NovTales**. This preview uses a separate Android package and does not replace the official app.
3. Add `https://raw.githubusercontent.com/Sadloif/lnreader-novtales/main/browser-plugins.min.json` as a source repository and install NovTales 1.1.0.
4. Open NovTales and select a novel. The website browser closes when its metadata loads.
5. Open a free chapter. Read or scroll through the website to let it load the chapter, then LNReader opens its complete text. Any website verification must be completed normally in the visible browser. Membership chapters still require valid website access.

Browser requests require LNReader to stay in the foreground. Background downloads are not supported for this source. Cancel closes a pending website request.

## Current evidence

- A public Chapter 1 loaded from 27 initial paragraphs to 89 paragraphs and displayed `End of Chapter 1` in Brave without signing in.
- App type checking and lint pass. Thirteen focused app tests verify source scoping, complete-page capture, redirects, stale results, cancellation, and foreground handling.
- Compiled plugin checks cover metadata, chapter ordering, previews, wrong-chapter rejection, membership gates, and content cleanup.
- Native Android operation is not yet verified. A successful APK build alone does not prove that NovTales accepts Android WebView.

## Error attribution

The old sentence claiming that every non-browser client is rejected at the TLS handshake came from the plugin's error text. The website returned HTTP 429 with Vercel browser-verification markers. That response does not establish the TLS claim. The new source reports the observed response without that claim.

This preview is independent of the LNReader and NovTales projects. The app patch applies to LNReader commit `a0c20e209c8b8d87c8982095e4ad44eafe13ee15` (2.1.4). Generated with OpenAI Codex; upstream source licensing remains applicable.
