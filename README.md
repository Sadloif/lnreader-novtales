# Standalone LNReader plugins — 1.0.1

These three English plugins use LNReader's normal network requests. They do not use a companion app, pairing key, computer service or account token.

| Source | Display name in LNReader | Chapter list |
| --- | --- | --- |
| https://maehwasup.com/ | Maehwasup | Return of the Mount Hua, including side stories and spinoffs published on this site |
| https://hennoveltranslations.org/ | Hen Novel Translations | Six projects; the site's FREE CHAPTERS lists |
| https://mylasted.blogspot.com/ | Machine Editing (MyLasted) | Main Mount Hua project and its separate Hwasan archive |

## Install

1. In official LNReader, open **Browse → Plugins → Repositories**.
2. Add this repository URL if it is not already present:

   `https://raw.githubusercontent.com/Sadloif/lnreader-novtales/main/plugins.min.json`

3. Refresh the repository, then install **Maehwasup**, **Hen Novel Translations** and **Machine Editing (MyLasted)**.
4. Open them under **Browse → Sources**. No filter or pairing setup is required.

All available chapter titles are returned as one list. A large novel may take around 10–30 seconds to load, depending on the connection. The list is saved only after every index page succeeds. Search filters the site's small project catalogue. Downloads and offline reading use LNReader's normal controls and storage; only fetching new chapters needs an internet connection.

These sites do not necessarily host a book from chapter 1 or every intermediate chapter. The plugins list the available public entries; they do not invent missing chapters or unlock advance chapters. Existing NovTales library entries are not automatically migrated to these different sources.

## Changes in 1.0.1

- Chapter HTML uses a formatting-tag and attribute allowlist. Event handlers, scripts, embedded content, styles and executable URL schemes are removed. Safe links and images remain.
- Hen rejects repeated or malformed chapter links, missing rows, unclosed lists, advertised pagination and mismatched declared totals. WordPress query-addressed episodes now retain their post IDs rather than being skipped. Every row in the site's free list is accounted for.
- MyLasted uses a consistent order: prologues, numbered chapters, unnumbered side stories ordered by publication date, then epilogues. Number/date/path tie-breakers make the order deterministic.

Hen does not publish an independent total of free chapters. These checks validate the complete list actually supplied by the site; an unadvertised server-side omission cannot be independently detected. The site's total Korean episode count includes unpublished/paid entries and is not a free-chapter count.

The recovered Barbarian links for episodes 584, 585, 589, 598, 599 and 600 are present in Hen's free list but currently return HTTP 404 on the website. They are now visible in LNReader; opening them correctly reports the missing page. The plugin cannot repair missing site content.

All nine project lists and their first/latest public chapters passed the compiled live checks. Thirty-eight regression checks cover HTML sanitation, malformed/incomplete lists, distinct query-addressed episodes, and consistent mixed chapter ordering; the twelve original failure checks also passed.

## Verification — 5 October 2026

The official LNReader plugin checker passed catalogue, search, novel and public-chapter checks for all three sources. The final ES5/CommonJS output was also checked directly against every project. Each chapter list had unique paths; the first and latest public chapter of each project returned readable text without scripts, embedded frames or forms.

| Project | Available chapter entries | First / latest entry checked |
| --- | --- | --- |
| Maehwasup: Return of the Mount Hua | 1,172 | Chapter 901 / Chapter 1978 |
| Hen: Martial Artist Lee Gwak | 411 | Prologue / Episode 410 |
| Hen: Surviving Game as a Barbarian | 747 | Episode 2 / Episode 797 |
| Hen: Genius Wizard Takes Medicine | 13 | Chapter 00 / Chapter 12 |
| Hen: Fist Demon of Mount Hua | 7 | Prologue / Episode 6 |
| Hen: Genius Martial Artist Who Remembers Everything | 28 | Chapter 01 / Chapter 28 |
| Hen: Reaper of the Drifting Moon | 189 | Chapter 461 / Chapter 650 |
| MyLasted: Hwasan Chapter 400–500 archive | 101 | Chapter 393 / Chapter 500 |
| MyLasted: The Return of Mount Hua Sect | 1,547 | Chapter 108 / Chapter 1758 |

Type checking against the reviewed official plugin API, ES5 compilation, targeted ESLint and formatting passed. Twelve additional checks verified HTTP refusals stop immediately, foreign page destinations are rejected, password forms and series pages are not returned as chapters, and repeated index entries fail instead of producing a partial list.

The contributor confirmed version 1.0.0 works in LNReader on Android. Version 1.0.1 was checked again on desktop; a fresh Android download/offline test of this patch was not performed.

## Source and build

Editable TypeScript is in `plugins/english/`; compiled plugins are in `dist/`. Run `npm install`, then `npm run build` to produce the CommonJS files LNReader installs. For the optional type check, place the official `lnreader/lnreader-plugins` repository with its dependencies alongside this folder; `tsconfig.json` points to its real API types. No dependencies need to be installed on the phone.

The icon images are simple initials drawn for these plugins. Signing keys, browser sessions, downloaded chapter HTML and development captures are not included in the source archive.

## Other source retained in this repository

The older NovTales plugin and its existing releases remain available. Its companion requirement applies only to NovTales; see [the NovTales guide](NOVTALES.md).

## Retained downloads

At most two published versions of each component are kept:

| Component | Latest | Previous |
| --- | --- | --- |
| Standalone plugins | [1.0.1](https://github.com/Sadloif/lnreader-novtales/releases/tag/standalone-v1.0.1) | [1.0.0](https://github.com/Sadloif/lnreader-novtales/releases/tag/standalone-v1.0.0) |
| NovTales companion | [0.1.4](https://github.com/Sadloif/lnreader-novtales/releases/tag/companion-v0.1.4) | [0.1.3](https://github.com/Sadloif/lnreader-novtales/releases/tag/companion-v0.1.3) |

NovTales plugin 2.1.0 remains the current version. Earlier companion 0.1.1 and 0.1.2 APK/source copies have been removed from the current repository files. Historical test reports remain available.
