# NovTales for LNReader

Add this repository URL to LNReader, refresh the source list, then install **NovTales**:

```text
https://raw.githubusercontent.com/Sadloif/lnreader-novtales/main/plugins.min.json
```

Keep the official LNReader plugin repository enabled alongside this one.

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

To edit and rebuild the source, use the [LNReader plugin development repository](https://github.com/lnreader/lnreader-plugins), placing `novtales.ts` in `plugins/english/` and the icon in `public/static/src/en/novtales/`. Follow its build and testing instructions. Publish the resulting JavaScript here and increment the version in both the source and manifest when updating.

## Validation

Created October 2, 2026. TypeScript compilation, targeted lint/format checks and local fixture checks passed. Public website data, chapter pagination and the membership gate were inspected in the browser. Automated live testing was inconclusive because NovTales returned HTTP 429 from the development environment. Android operation remains unverified.

If the website challenges your device, try opening NovTales in LNReader's WebView and completing the site's verification. Membership access remains subject to the website's requirements.

This plugin was developed with assistance from OpenAI Codex. It is an independent source plugin and is not affiliated with NovTales or the LNReader project.
