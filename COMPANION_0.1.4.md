# Companion 0.1.4 — new novel loading

Official LNReader and plugin 2.1.0 remain unchanged. Install this companion as an update; existing pairing is retained.

## Reproduction and cause

The user's Return of the Mount Hua Sect catalogue entry is `/novel/return-of-the-mount-hua-sect-2`. Its metadata loaded through companion 0.1.3, but a full chapter-title collection failed at page 19 with a native TIMEOUT. Became a Serpent's metadata and its complete 434-entry, nine-page index passed through the same installation. These results do not support treating all new novels as a single parser failure.

LNReader displays its own generic "Unable to load novel" banner when any new-novel bootstrap stage fails. The source review found no concrete plugin or database-insertion defect. The companion's navigation waiter depended on `onPageFinished`, which can arrive later than the main document commit. The timeout result did not identify the exact stalled stage.

A subsequent 0.1.4 phone run identified a separate concrete website response failure at reader page 18: its HTTP-successful chapter-index response declared page 1, page size 100, zero chapters and total zero, although the companion requested page size 50 and preceding pages contained chapters. Strict validation rejected it. An earlier run failed the same validation at page 3; that run did not yet capture numeric response details.

## Changes

The companion now releases navigation when Android reports that the new main document has committed. Requested page data, HTTP intervention signals and complete chapter markers are still checked before returning results. Images and other resources no longer have to finish first. `onPageFinished` remains a fallback callback.

Novel metadata polling permits approximately 30 seconds for streamed references within the existing 45-second operation deadline. It validates the requested novel rather than accepting a link-only DOM fallback. Unresolved Flight references in title or synopsis remain pending until their rows arrive; ordinary JSON text beginning with a dollar sign remains valid.

Chapter-index fetches request uncached responses. A malformed successful response gets one retry after one second, with the same full page/count validation. A persistent malformed response fails; HTTP errors, verification and reading interventions never enter this retry. Navigation callbacks from an old browser instance are ignored, and an active operation cannot clear captured website warning signals just because its main document has committed.

A full Return test still timed out at reader page 10 after those changes. The index operation had been reopening the entire novel page for every 50-title window. It now retains a successfully validated novel document for subsequent index requests for the same path, WebView and website identity. Each window still checks website attention; any missing API page is explicitly fetched and validated. Switching novels, reading a chapter, clearing the session, failure or cancellation invalidates that reusable context. Document extraction continues to reset between operations. Timeout errors now identify the operation stage.

With page reuse, Return passed 31 windows before the website refused a chapter-list request with HTTP 429. That response was not retried. Repeated requests for the count page and overlapping source pages still multiplied website traffic. The index context now retains validated API pages for the same five-minute lifetime as the result cache: the first count page plus at most seven other pages. Sequential ascending windows reuse their overlap, so a 34-page novel needs 34 distinct site pages, rather than repeatedly fetching the first and overlapping pages. Fresh pages must match the snapshot's total; partial, inconsistent or refused data are never cached.

This change does not override NovTales verification, reading pauses, paid access or HTTP rate limits. The final 0.1.4 public-chapter test still received HTTP 429; the website's reading restriction remains a separate limitation.

## Verification

Verified on 5 October 2026:

| Check | Result |
| --- | --- |
| Native unit tests | 721 passed |
| Browser adapter tests | 426 passed |
| Android lint | 0 errors; 18 existing warnings |
| Release APK build | Passed |
| Return of the Mount Hua Sect | All 1,683 distinct chapter titles collected across 34 windows and returned as one page |
| Became a Serpent in the Immortal World | All 434 distinct chapter titles collected across nine windows and returned as one page |
| Official LNReader interface | Both reported new novels opened successfully, displaying 1,683 and 434 chapters respectively |
| Switching novels | Metadata and first 50 titles passed for seven other novels; returning to the catalogue returned 24 items |
| Public chapter in official LNReader | Serpent chapter 1 was refused by NovTales with HTTP 429; no retry or download was attempted |

The two full-index tests used the final installed companion 0.1.4 on the Oppo and compiled plugin 2.1.0. Their recorded output is in `_working/return-cached-final-0.1.4.txt` and `_working/serpent-cached-final-0.1.4.txt`. Reopening the same novels in unmodified official LNReader 2.1.4 also completed their metadata and full lists. Neither novel was added to the user's library by this test.

The switching check covered Genius Martial Artist (770 entries), Great Heavenly Demon Sovereign (1,379), Murim Psychopath (284), Mysteries of Immortal Puppet Master (1,139), Wall Street Genius (176), Absolute Regression (897), and Barbarian (961). Each first page had 50 titles. The count of Great Heavenly Demon Sovereign increased by one since the previous release's test.

The final reading check used LNReader's normal Start reading control for Became a Serpent chapter 1. The error explicitly reported a website HTTP 429 response. Its readable wording comes from the plugin/companion; the HTTP refusal comes from NovTales. This was not a browser-verification diagnosis based only on status 429. No successful fresh chapter reading, download or offline test is claimed for 0.1.4. The successful 0.1.2 download/offline checks remain historical evidence. Follow any action displayed by NovTales before retrying reading; the companion does not acknowledge warnings or solve verification checks.

The update kept the existing production package, signing identity and pairing. Temporary USB access and stay-awake are removed after testing. This release is marked as a prerelease because fresh chapter reading remains blocked by the website.

Release APK SHA-256: `aa1fd01cc2a9050ee8f9f3be4dae848fd6596e23a1ba83080325f4bf60866e48`.

Download the APK and source archive from [Companion 0.1.4 releases](https://github.com/Sadloif/lnreader-novtales/releases/tag/companion-v0.1.4). Plugin 2.1.0 stays unchanged; install the companion update over the existing app to preserve pairing.
