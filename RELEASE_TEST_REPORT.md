# NovTales 0.1.2 release test report

Verified on the user's physical phone, 4 October 2026. This supersedes the initial 0.1.0 test report. See the root REVIEW.md for fixes and setup.

| Component | Observed version |
| --- | --- |
| Phone | Oppo CPH2825 / OP62B1L1 |
| Android | 16 |
| ColorOS build property | V16.1.0 (`ro.build.version.oplusrom`) |
| Active Android System WebView | com.google.android.webview 155.0.8059.16 |
| Official LNReader | 2.1.4 |
| Companion | 0.1.2, versionCode 3 |
| Plugin | 2.0.2 |
| Local API | 1 |
| Gradle / AGP / Kotlin | 8.9 / 8.7.3 / 2.0.21 |
| Minimum / target / compile Android SDK | 26 / 35 / 35 |

## Automated evidence

- Final native test XML: 703 tests, zero failures. The final build ran testDebugUnitTest, lintDebug and assembleRelease successfully.
- Android lint: zero errors, 15 warnings.
- Bundled website adapter: 420 checks passed, zero failed.
- Compiled plugin smoke harness: 117 checks passed, zero failed.
- TypeScript check and production JavaScript emission passed.
- Release APK uses the original signing certificate. Signing secrets and machine-specific SDK configuration are excluded from the source ZIP.

Native tests cover request authentication and input bounds, rejected destinations, decimal chapter paths, cancellation and queue isolation, parser failures, chapter identity and explicit completion, pagination coverage, and HTML cleanup. These are JVM tests; they do not substitute for the physical-phone checks below.

## Physical-phone evidence

| Requirement | Observed outcome |
| --- | --- |
| Fresh install, start, pair, catalogue | Production APK installed; official LNReader refreshed the existing repository, installed the new source, accepted the copied pairing key and loaded normal catalogue cards. |
| Public chapter without sign-in | Chapters 1–4 returned completed HTML through the companion; no NovTales account was required. |
| Multi-part delivery and app switching | Complete chapters 2, 3 and 4 passed the phone API/plugin tests while LNReader was in front and the companion browser screen was closed. |
| Catalogue pagination and search | Page 1 returned 24 results, page 2 had distinct paths; matching and unmatched searches passed. |
| Chapter pagination | Novel count 961, 20 reader pages; page 2 had 50 rows, page 20 had 11, page 21 was empty. |
| Complete native download | LNReader saved Chapter 1 and displayed the downloaded check mark. Chapter 2 was also saved in the subsequent test. |
| Offline reading | With the companion force-stopped and Wi-Fi/mobile data disabled, the previously unopened downloaded Chapter 1 rendered in official LNReader. Network settings were restored afterward. |
| Library and progress | The test novel was newly added using LNReader's own control; after reading, LNReader displayed Chapter 1 progress at 16%. Existing library data was preserved. |
| Local API binding | The phone's listening socket was restricted to 127.0.0.1:5301; the IPv6 socket report showed the IPv4-mapped loopback address. |
| Screen-off batch | Brief screen-off check saved Chapter 2 but left Chapter 3 pending. A later screen-on batch saved Chapters 3 and 4. Screen-off batch reliability is unproven; keep LNReader open during batch downloading. |

## Limits and release gate

The required public-chapter download and offline-open gate passed in the unmodified official LNReader app on the Oppo. The screen-off observation is recorded above. An offline app restart, TTS playback and additional reader controls were not manually exercised. Paid access, deliberately triggered CAPTCHA/reading notices, long bulk downloading, battery-saver duration and external illustration downloads were not exercised. The adapter stops for required site actions; it does not solve checks or acknowledge reading warnings.

The companion uses Android's dataSync foreground-service type with its normal time limits, no wake lock and no battery-exemption request. A killed or stopped companion must be restarted from its own Start control. No PC is required for normal use.

APK SHA-256: f2404fd34c17ec8c24bae18c7f610bbf658080202431615aa1dc7405639990db

Signing certificate SHA-256: b8643bc425e4d4f3d387e91af74c0c940a9a6a14fb8eb7344d69a6b83ac38890

Companion 0.1.2 phone check: updated the same production package without resetting the key; status and pairing guide rendered clear of system bars; Copy pairing key displayed the guide; Open LNReader launched the official app. Chapter 5 downloaded using the previously saved pairing. Only the production companion is installed; the debug package was removed.
