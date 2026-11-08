# Song translations: official, poetic and literal

Status: implemented on `redesign/v2` (migration `0052_song_translations`, API `app/api/v1/song_translations.py`,
app `lib/songTranslations/*`, `components/song-page/TranslationBody.tsx`). The visual board with the mock-ups and the
real screenshots (Russian) is kept outside the repo:
`~/Documents/Carousel/Для-Дады/ps-два-перевода/index.html`.

## What the reader gets

The song page text block has three horizontally paged pages:

1. **Lyrics**: Roman or Devanagari (the switch in Aa). No translation by default. Aa has "Translation under each line":
   Off (default), Literal, Poetic, and only the kinds this song has. Official cannot be chosen there.
2. **Translation**: a switch Official / Poetic / Literal (only kinds the song has), the full text, below it the
   commentary (hidden when empty). The 91 songs with two official versions show the second one under "Other version".
3. **Word by word**: a language choice (en, ru, es, extensible) built from the languages that really have meanings.
   Empty: "No word meanings yet" with a request.

The official English translation is called "Official". Poetic is never the default (the default is Official, then
Literal). The kind, the under-line mode and the word-by-word language are remembered on the device
(`stores/songPageStore.ts`, `prabhat-song-page-v2`, persist version 3).

The Commentary tab is gone; the tabs are Lyrics, Recordings, Chords, Video. The old Central idea is the "song
information" block at the end of the Lyrics tab. "In plain words" is never drawn empty.

Scrolling: the pages are a plain horizontal row. A finger that goes up or down scrolls the page (vertical wins every
doubt, see `lib/songPage/pager.ts` `decideAxis`); only a clear sideways move turns the pages. On the web the gesture
view sets `touch-action: pan-y`.

## Who may write, what readers see

- Only the team writes translations. Members do not offer translations (Dada, 2026-11-08).
- "Checked" (`trust = verified`) is set only by the team through the admin API
  (`POST /admin/song-translations/{id}/verify`, named checker and time). The migration forbids a checked row without
  a checker, a machine text that is not poetic, and the official label on anything but the official import.
- The server never serves `unchecked` or `machine` rows. A literal text is served only when it is checked.
  Official is served as official; other poetic texts as "reviewed".
- The app draws the Checked mark only for rows the server marks checked.
- Other sources (Sarkarverse and the like) are not shown anywhere in the UI.

## Data model

One table, `song_translations`, one row per translation. Kind, language and version are values, not columns on `songs`.

| Field | Meaning |
| --- | --- |
| `song_id` | the song number (1..5018) |
| `language` | `en` by default |
| `kind` | `official`, `poetic`, `literal` |
| `position` | order among rows of one song, language and kind; 0 first (others are "Other version") |
| `segments`, `alignment` | `[{"from":0,"to":1,"text":"...","doubt":null}]`, 0-based inclusive indexes of the lyric lines as the app draws them; `whole`, `stanza`, `line` |
| `plain_text`, `text_hash` | search; idempotent import |
| `author_kind`, `author_label`, `source_key`, `source_ref`, `credit_line`, `license_note` | origin; `license_note` is internal and never served |
| `trust` | `unchecked`, `reviewed`, `verified`, `official`, `machine` |
| `status` | `draft`, `pending`, `published`, `rejected`, `archived` |
| `commentary` | explanation shown under the translation; empty means no block |
| `doubts`, review trail, `replaces_id`, `based_on_id`, `published_at` | internal |

Rules: segments are placed by a person, the code never splits a translation on its own; editing a published row
creates a new row and archives the old one; a checked row is never changed in place; `songs.english_meaning` is not
changed (the import reads it).

## API

- `GET /song-translations/songs/{song_id}?language=en`: published, visible rows and the kinds the song has.
- `GET /song-translations/availability?language=en`: which songs have which kind.
- Team review (`/song-translations/review/queue`, `.../review/{id}/verify|unverify`).
- Admin (`/admin/song-translations`): list, add, `verify`, `unverify`, `archive`, `restore`, `import?dry_run=1`.

## Import

`POST /admin/song-translations/import` reads `songs.english_meaning`, splits on a line of dashes (the second version
gets `position` 1), `kind=official`, `trust=official`, one segment over the whole song (`alignment=whole`). 5015
songs, 91 with two versions. Idempotent by text hash; never overwrites a row the team has edited. It is a deliberate
step and is NOT run by the migration.

Until the import runs (and while the production API has no endpoint) the app derives the official text from
`english_meaning` itself (`lib/songTranslations/derive.ts`, same split rule as the server).

## Deviations from the first proposal

- No `translation_kinds` in `GET /songs/{number}`: the page asks the translations endpoint.
- Official is imported as one whole-song segment, not line-aligned. For "under each line" the client pairs a segment
  with lines only when the segment is marked `line` or `stanza`; a `whole` text gives no pairing and a short note.
- A literal translation is shown only when checked (the proposal showed unchecked ones with an amber label).
- No member proposals, no `member_id`, no report table, no team screen (the admin API only).
- Dada's Notion pages and Sarkarverse are not imported yet; Dada decides the sources.

## Open decisions

Where the poetic and literal texts come from; whether a small team screen is needed; the source of word-by-word
glosses (46 Notion songs); search over `plain_text`; wording of the labels in ru/es (in `locales/review.json`).
