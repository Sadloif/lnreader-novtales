# NovTales for official LNReader — 2.0.2

Use this TypeScript source plugin with NovTales Companion **0.1.2** on the same Android phone. Official LNReader remains the reader and download manager.

## Setup

1. Download and install [NovTales Companion 0.1.2](https://github.com/Sadloif/lnreader-novtales/raw/refs/heads/main/NovTales-Companion-0.1.2.apk), then press **Start**.
2. Add or refresh your existing LNReader repository:
   `https://raw.githubusercontent.com/Sadloif/lnreader-novtales/main/plugins.min.json`
3. Install/update NovTales to **2.0.2** from this repository.
4. In the companion, tap **Copy pairing key**, then **Open LNReader** in the guide.
5. In LNReader, go to **Browse → Sources → NovTales**, then tap **Filter** at the bottom.
6. Long-press **Companion pairing key (paste here)**, choose **Paste**, then tap **Filter** at the top-right of the panel to save.

Your Oppo is already paired. Updates preserve the saved key. See [the pairing guide](PAIRING.md) for help replacing an old key.

The key is a local companion credential, not a NovTales account token. Public chapters do not require sign-in. Site checks, paid access and reading notices require the appropriate action in the companion website.

## Behaviour

Popular/latest catalogue and title/alternative-title search use distinct pages. Novel metadata and ascending chapter pages retain the existing `/novel/{slug}` and `/chapter/{slug}-{number}` paths, including decimals. The plugin accepts only complete chapter HTML. Catalogue errors and incomplete chapter lists stay visible rather than being treated as empty pages.

Keep the companion running while fetching or downloading, and keep LNReader open during batch downloads. Downloaded chapters are stored in LNReader and work offline with the companion stopped. No computer or remote service is used during normal reading.

This companion supports **NovTales only**. Other sources keep using their own LNReader plugins.

## Validation

The 2.1.4 tagged LNReader source supports the text pairing filter. The connected Oppo CPH2825 runs Android 16 and official LNReader 2.1.4. The release APK was paired with official LNReader; catalogue, novel details, a public chapter download and offline reading passed. The offline check stopped the companion and disabled Wi-Fi and mobile data before opening the downloaded chapter. See [REVIEW.md](REVIEW.md) for the evidence and remaining limits.

The [reviewed source ZIP](https://github.com/Sadloif/lnreader-novtales/raw/refs/heads/main/NovTales-Companion-0.1.2-source.zip) includes the Kotlin companion, TypeScript plugin, build instructions and test harnesses. Release signing secrets are excluded.


