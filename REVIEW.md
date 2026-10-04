# NovTales Companion review — 4 October 2026

Delivery: companion 0.1.1 (version code 2), LNReader plugin 2.0.1, local API 1.
Official LNReader remains the reader, library and download manager. This project is a separate Kotlin Android companion plus a TypeScript source plugin.

## Findings and fixes

| Finding in the supplied build | Change |
| --- | --- |
| Search loaded a guessed query URL and ignored the search words during extraction. | Filter the site's full `/explore` catalogue by title, slug and alternative names. |
| Catalogue pages repeated the full catalogue. | Return distinct 24-item pages and an actual end of list. |
| Every chapter-list page reread the entire novel; failed API responses could masquerade as the end. | Read the site's declared count, validate page metadata and row counts, and fetch only the one or two newest-first API pages overlapping each ascending 50-chapter reader page. |
| A failed index could lead the plugin to invent a page count. | Preserve the failure; use confirmed counts or an observed short final page. |
| Browser checks disappeared when the failed request cleared the WebView. | Keep the page available and prevent queued jobs from navigating over an outstanding user notice/check. |
| `Open website` could display a blank page. | Open the homepage when the idle browser is blank. |
| A detached WebView did not finish public chapters on the Oppo. | Keep it in an app-owned private rendering surface while LNReader is in front. Move that same browser into the companion screen when the user opens it. |
| HTTP 429 was checked before challenge response headers. | Read verified challenge headers first; report a plain 429 as a rate limit. |
| A generic reading pause could be misreported as sign-in. | Require sign-in copy and identify reading notices separately. Never acknowledge them automatically. |
| Cached metadata never expired; large results could occupy excessive memory. | Five-minute expiry, 40-entry limit and a maximum cached result size. |
| Local requests could hang outside the polling deadline. | Bound both connection and JSON response reads. |
| The documentation claimed LNReader 2.1.4 pairing input was unverified. | Its tagged source contains `TextInput = 'Text'`; the connected phone runs official 2.1.4. |
| Lint errors would not stop packaging. | Enable failure on lint errors. |

The original delivered APK and source archive are retained under `dist` for comparison. New releases reuse the original signing certificate; the private signing files are excluded from the source ZIP.

## Error wording

The long message about every non-browser client being rejected at the TLS handshake is an application/plugin explanation, not proof supplied by an HTTP 429. A response status alone does not establish the cause. This companion reports observations separately: verified challenge markers, plain rate limits, required sign-in, membership, reading notices, unavailable network and incomplete chapters.

## Verification

Automated validation: 703 Kotlin tests passed; the JavaScript adapter suite passed 420 checks; the revised compiled-plugin smoke suite passed 117 checks. Type checking and release packaging succeeded. Android lint reported 15 warnings and zero errors (style, unused resources, target SDK and the required JavaScript capability).

On the connected Oppo CPH2825 (Android 16), using official LNReader 2.1.4 in front, the compiled plugin connected to the phone's companion and passed catalogue page separation, matching/empty search, novel metadata, page 2 and the last chapter page, confirmed end of list, and complete public chapters 3 and 4. The test novel reported 961 chapters across 20 pages, with 11 rows on the final page. Chapter 2 also completed with the companion website closed. These were live phone API/compiled-plugin tests.

Native LNReader verification also passed with the production release APK: refreshed the existing public repository, updated NovTales, copied and pasted the companion pairing key, loaded the catalogue and novel details, and downloaded Chapter 1 of Surviving the Game as a Barbarian. LNReader displayed its downloaded check mark. With the companion force-stopped and both Wi-Fi and mobile data disabled, the previously unopened downloaded chapter rendered in LNReader. Connectivity was restored and the companion restarted afterward. The test novel was newly added to the library; existing library records were preserved.

A public chapter requires no sign-in. Paid chapters retain the site's own access requirements. A required check or notice is left for the user to complete in the companion. Long bulk downloads, deliberate site checks, membership and screen-off duration were not exercised in this short test.

APK SHA-256: `e25fe429960a6cc714b3d5699c391298225bda5188502ab443f8404b2c1e339c`.
Signing certificate SHA-256: `b8643bc425e4d4f3d387e91af74c0c940a9a6a14fb8eb7344d69a6b83ac38890`, matching the original delivery.

The private rendering surface uses Android's [DisplayManager](https://developer.android.com/reference/android/hardware/display/DisplayManager) and [Presentation](https://developer.android.com/reference/android/app/Presentation) APIs. It renders only the companion's WebView, uses no screen capture, and adds no overlay or accessibility permission. Android's normal foreground-service limits still apply; see its [service timeout documentation](https://developer.android.com/develop/background-work/services/fgs/timeout).

## Installation and normal use

1. Install `dist/NovTales-Companion-0.1.1.apk` and press **Start**.
2. Install/update the NovTales source to **2.0.1** in official LNReader.
3. In the companion, copy the pairing key. In LNReader's NovTales filter panel, paste it into **Companion pairing key** and apply.
4. Browse and download in LNReader. Keep the companion running while fetching new pages. Open its website only when a check or account action actually requires you.
5. Downloaded chapters are stored by LNReader. Reading a downloaded chapter offline does not need the companion or a computer.

Companion 0.1.1, plugin 2.0.1 and the source ZIP were published to [Sadloif/lnreader-novtales](https://github.com/Sadloif/lnreader-novtales) on 4 October 2026 with the owner's approval. The existing repository URL and source identity remain unchanged. The release APK and repository update were installed on the connected Oppo and paired with official LNReader.

