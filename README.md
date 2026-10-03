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
- Members-only chapters marked with a lock. Locked previews report the website's
  membership requirement.

## Files

- `plugins.min.json`: the repository list read by LNReader.
- `novtales.js`: the compiled plugin downloaded by LNReader.
- `novtales.ts`: TypeScript source for maintenance.
- `icon.png`: a 96px version of NovTales' existing logo.
- `gate-watch.cjs`: polls NovTales and reports its current reachability state.
- `findings.md`: the full validation evidence, and how to reproduce it.

To edit and rebuild the source, use the
[LNReader plugin development repository](https://github.com/lnreader/lnreader-plugins),
placing `novtales.ts` in `plugins/english/` and the icon in
`public/static/src/en/novtales/`. Follow its build and testing instructions. Publish the
resulting JavaScript here and increment the version in both the source and manifest when
updating.

## Validation

Created October 2, 2026. Strict TypeScript, ESLint, Prettier and the plugin repository's
`check:plugin` live check all pass. Android operation has not been verified.

The parsers were verified against live NovTales data: 212 catalogue entries, 81 chapter
pages, decimal chapters (`944.5`, `943.5`) and locked-chapter flags all parsed correctly,
along with novel metadata, reverse pagination and status mapping. The full evidence and
reproduction steps live in `novtales-validation/findings.md` in the development
workspace.

**Chapter text is member-delivered.** `POST /api/public/chapter-grant` is available to
signed-in members only; a signed-out visitor receives an empty chapter body, because the
text is fetched client-side once a grant succeeds. Signed-out reading therefore covers
metadata and chapter lists, and the plugin reports the membership requirement rather than
working around it.

## When chapter text needs an official route

Where a chapter cannot be delivered directly, the supported route is official access: an
API key or a documented public read endpoint. A draft request to the site, including an
offline/export question, is prepared in `novtales-validation/novtales-outreach.md` in the
development workspace.

## Version 1.0.3

Rate-limiting responses are retried twice with a short backoff before the plugin reports
them, which makes the source more tolerant of ordinary traffic limits and of bursts when
paging through long chapter lists. No change to parsing, chapter pagination or chapter
delivery. Covered by a behaviour test at `probe/plugin-behaviour.test.cjs` in the
development workspace.

## Version 1.0.1

Included the device's cookies explicitly in page requests and avoided LNReader's
synthetic request headers while retaining the app's WebView user agent.

---

This plugin was developed with assistance from OpenAI Codex and DeepSeek Harness. It is an
independent source plugin and is not affiliated with NovTales or the LNReader project.