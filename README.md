# NovTales for LNReader

This is a plugin for the official LNReader app. No custom app or APK is required.

Add this repository in LNReader, refresh it, then update NovTales to **1.0.4**:

```text
https://raw.githubusercontent.com/Sadloif/lnreader-novtales/main/plugins.min.json
```

Keep the official LNReader source repository enabled alongside this repository.

## Current status

The website access problem is **not fixed yet**. Current command-line checks receive
HTTP 429 with Vercel browser-verification markers. Desktop Brave can load a complete
public chapter without signing in, but that does not verify Android plugin requests.

Version 1.0.4 corrects diagnostics and incomplete-chapter handling. It uses only existing
LNReader plugin interfaces, caches a successful catalogue for five minutes to reduce
repeated requests, and rejects previews as incomplete chapters. It does not implement
NovTales' protected chapter delivery.

The custom-app experiment was canceled at the user's request. Development is plugin-only.

## Who defines the error?

NovTales returned the HTTP response. The long message saying every non-browser client
is rejected at the TLS handshake was written in our plugin. The observed response did
not establish that explanation. Version 1.0.4 reports browser verification or ordinary
rate limiting without asserting a TLS cause.

Sign-in is not required for every public chapter. Paid membership and protected delivery
are separate conditions. A nonempty initial chapter body can be a preview.

## Features and validation

Catalogue and title search, novel metadata, oldest-first chapter pagination, decimal
chapter numbers, and text cleanup are implemented. Parser and compiled-plugin fixture
checks pass, as do TypeScript, lint, and formatting checks. Live access remains
inconclusive because of HTTP 429. Complete reading in the official Android app is
unverified; changing an error message does not resolve website access.

Source files are `novtales.ts` and its compiled `novtales.js`. Edit TypeScript in the
[LNReader plugin development repository](https://github.com/LNReader/lnreader-plugins)
and compile with its production settings; do not hand-edit the compiled bundle.

This independent plugin is not affiliated with NovTales or LNReader. Developed with
assistance from OpenAI Codex and DeepSeek Harness.
