# Standalone LNReader plugins — 1.0.0

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

## Verification — 5 October 2026

The official LNReader plugin checker passed catalogue, search, novel and public-chapter checks for all three sources. The final ES5/CommonJS output was also checked directly against every project. Each chapter list had unique paths; the first and latest public chapter of each project returned readable text without scripts, embedded frames or forms.

| Project | Available chapter entries | First / latest entry checked |
| --- | --- | --- |
| Maehwasup: Return of the Mount Hua | 1,172 | Chapter 901 / Chapter 1978 |
| Hen: Martial Artist Lee Gwak | 411 | Prologue / Episode 410 |
| Hen: Surviving Game as a Barbarian | 741 | Episode 2 / Episode 797 |
| Hen: Genius Wizard Takes Medicine | 13 | Chapter 00 / Chapter 12 |
| Hen: Fist Demon of Mount Hua | 7 | Prologue / Episode 6 |
| Hen: Genius Martial Artist Who Remembers Everything | 28 | Chapter 01 / Chapter 28 |
| Hen: Reaper of the Drifting Moon | 187 | Chapter 461 / Chapter 650 |
| MyLasted: Hwasan Chapter 400–500 archive | 101 | Chapter 393 / Chapter 500 |
| MyLasted: The Return of Mount Hua Sect | 1,547 | Chapter 108 / Chapter 1758 |

Type checking against the reviewed official plugin API, ES5 compilation, targeted ESLint and formatting passed. Twelve additional checks verified HTTP refusals stop immediately, foreign page destinations are rejected, password forms and series pages are not returned as chapters, and repeated index entries fail instead of producing a partial list.

These are desktop live-site checks of the actual compiled plugins. The phone was disconnected, so installation, downloads and offline reading on Android were not freshly tested for these three plugins.

## Source and build

Editable TypeScript is in `plugins/english/`; compiled plugins are in `dist/`. Run `npm install`, then `npm run build` to produce the CommonJS files LNReader installs. For the optional type check, place the official `lnreader/lnreader-plugins` repository with its dependencies alongside this folder; `tsconfig.json` points to its real API types. No dependencies need to be installed on the phone.

The icon images are simple initials drawn for these plugins. Signing keys, browser sessions, downloaded chapter HTML and development captures are not included in the source archive.
