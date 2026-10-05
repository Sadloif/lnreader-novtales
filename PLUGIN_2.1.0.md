# NovTales plugin 2.1.0 — single-page chapter list

Date: 5 October 2026. Companion remains 0.1.2; local API remains version 1.

The user reported that selecting chapter-list page 2 or 3 in official LNReader kept the first 50 chapter rows. The native LNReader 2.1.4 source sets the selected page before fetching it and can keep the old rows after a failed fetch. This explains how the symptom can occur; it does not establish the failure that occurred on this phone. Earlier companion/plugin page tests did not exercise the native page buttons.

The user requested NovelFire's existing “Force load all chapters on a single page” setting. NovTales now exposes an opt-in `singlePage` Switch through LNReader's plugin-settings screen. The value is read at request time. No LNReader or companion app code was changed.

When enabled, the plugin reads every 50-chapter index page sequentially through the existing companion API. It validates page lengths, stable total counts, unique paths and the requested novel, sorts the list ascending, and returns the entire list with `totalPages: 1` and chapter `page: '1'`. A failed page propagates its error and invalidates the snapshot; no partial full list is returned. Website verification and reading restrictions remain terminal errors requiring user action. Each page retains its existing timeout, and the combined crawl has a ten-minute ceiling.

A persisted per-novel layout marker makes turning the setting off followed by Refresh return every chapter with its original 50-chapter page assignment, including after LNReader restarts. LNReader 2.1.4's chapter upsert updates page metadata by the same novel/path identity without changing chapter IDs or download/read-state fields. This preservation was checked in the tagged app source; migration on the phone has not yet been exercised.

## Installation and use

1. Refresh `https://raw.githubusercontent.com/Sadloif/lnreader-novtales/main/plugins.min.json` in LNReader and update NovTales to **2.1.0**.
2. Choose **Browse → Plugins → gear beside NovTales**.
3. Enable **Force load all chapters on a single page**.
4. Keep NovTales Companion running. Open the affected novel, choose **Refresh** in the novel menu, and leave LNReader open until loading finishes.
5. All chapter titles should appear together. Download and offline reading remain LNReader functions. No new APK or pairing key is needed.

The first load can take several minutes. This collects chapter titles, not chapter bodies. If it fails, resolve the displayed error and refresh again. Switching the setting off also requires a novel refresh.

## Verification

TypeScript checking, formatting and ES5/CommonJS production compilation passed. The compiled-plugin test harness finished with **145 passed, 0 failed**. It verifies a 961-chapter novel across 20 sequential companion jobs, complete ordering/uniqueness, cache reuse, empty novels, cold page loading, immediate switch changes and restoring page assignments after simulated restart. Missing, repeated and changing pages, and a wrong page count, fail explicitly; website verification stops the crawl and permits a clean user retry. Existing catalogue, paging, pairing, chapter-body validation, error handling and bounded polling are also exercised.

Published compiled-plugin SHA-256: `64682fc09d6fa46d62b628fb93d953525f65db1cfdd5141c6974304b77c2d016`.

These are compiled-plugin tests with a simulated companion, not a fresh live website or Oppo UI test. No phone was connected during this update. Companion 0.1.2 and the previous plugin had already passed live public chapter download/offline tests on the Oppo; those results do not prove this new setting's phone behavior.
