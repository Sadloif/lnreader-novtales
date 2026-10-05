# Companion 0.1.3 — public novel browsing repair

Date: 5 October 2026. Plugin remains 2.1.0; official LNReader remains unchanged.

## Reproduced problem

On the connected Oppo CPH2825 (Android 16), official LNReader 2.1.4 opened Barbarian successfully but failed when opening The Genius Martial Artist Who Remembers Everything. A request through the installed companion returned MEMBERSHIP_REQUIRED before retrieving novel metadata. The companion then retained this attention state for subsequent requests.

The adapter checked membership headings and phrases on every page. A novel page's subscription promotion could therefore be mistaken for a locked chapter. This error originated in our companion's classification, not a requirement to sign in to browse public novels.

After correcting that classification, the same novel exposed a second parser failure: a Next.js Flight reference could be extracted without the rows needed to resolve it. The adapter now keeps the bounded Flight stream internally for native resolution; metadata must match the requested novel rather than a recommendation. The native scanner also recognises byte-length-prefixed Flight text rows, so quotes and braces in captions or synopses cannot consume later data rows. UTF-8 lengths are respected for non-English characters and emoji.

## Repair

Membership detection applies only to chapter-reader paths. A membership restriction remains attached to its requested chapter; it does not prevent catalogue, search, novel metadata, chapter-title lists or another chapter from loading. Browser verification and reading notices still require the user's action and remain on screen.

A live public Mysteries of Immortal Puppet Master page returned an adapter envelope marked not ready, while replaying that same captured stream through the native parser returned the correct novel metadata. Novel polling now uses the native parser to establish readiness, including streams whose requested reference has not arrived yet. It waits within the existing bounded poll/deadline limits instead of accepting an unresolved prop or rejecting an adapter false negative. Only validated metadata for the requested novel is accepted.

The production package and signing identity remain the same. Install the APK as an update, then start the companion. Existing pairing and website session are retained. Plugin 2.1.0 already contains the single-page setting.

## Barbarian verification

With single-page mode enabled, the published plugin retrieved 961 unique chapter titles from the phone's companion across 20 index pages. The cold request took approximately 104 seconds. In official LNReader, refreshing the existing Barbarian novel changed its saved 50-chapter/page layout to a single list of 961 chapters. The latest entry is chapter 944.5; decimal chapters explain the difference between chapter number and title count. Continue reading still pointed to chapter 3.

Large novels still require time to collect their chapter titles. This release repairs the incorrect access classification; it does not change the full-index transport.

## Verification

The release build, Android lint and 712 native unit tests passed with zero failures. The JavaScript adapter tests passed 426 checks with zero failures. The APK signature matches the existing production installation. Final phone checks are recorded below. Signing secrets, pairing credentials, private phone dumps and build caches are excluded from source delivery.

## Final installed-phone results

The signed 0.1.3 production APK was installed over the existing companion on the Oppo. Pairing stayed intact; no second companion app was installed. Through the published 2.1.0 plugin and the installed companion, sequential metadata and first chapter-title pages passed for Genius Martial Artist (770 entries), Great Heavenly Demon Sovereign (1,378), Murim Psychopath (284), Mysteries of Immortal Puppet Master (1,139), Wall Street Genius (176), Absolute Regression (897), and Barbarian (961). Returning to the catalogue returned 24 items.

Doctor's Rebirth was checked separately after the user's further report. Full-index collection returned 1,449 distinct chapter paths across 29 pages in approximately 124 seconds, with some initial pages already cached. Reopening it in official LNReader then displayed its details and 1,449 chapters on a single page. Barbarian still displayed 961 entries and Continue reading chapter 3 on the final APK. Genius had also displayed its full 770-entry list in LNReader during the parser verification.

The final chapter-body check did **not** pass: public chapter 1 requests for Barbarian and Doctor's Rebirth received HTTP 429. Opening the companion's own browser showed NovTales' reader message, "Please slow down", with "Unusual activity detected." This is a website reading restriction, not the metadata parser or membership false positive repaired here. A separate queued check expired while other phone work was active. No chapter was saved from these failed checks. This release verifies browsing and chapter-title collection; previous release download/offline checks are historical evidence, not a successful fresh reading check for 0.1.3. Wait and use the site's displayed retry/verification instructions before retrying reading. The companion does not override these restrictions.

Temporary browser inspection was removed. The final installed companion had no debugging socket, and the released APK contains no debugging-enable call. Android lint reported 0 errors and 18 existing warnings.

APK SHA-256: `ee7a04b77bd0836c7e26d7addae0014bafcd503853bdded3c994f72fc1dcabf8`.

Signing certificate SHA-256: `b8643bc425e4d4f3d387e91af74c0c940a9a6a14fb8eb7344d69a6b83ac38890`.
