# Two kinds of song translation: poetic and literal

Status: proposal, nothing implemented. No app code, migration or endpoint exists yet.
The visual board with mock-ups (Russian) is kept outside the repo:
`~/Documents/Carousel/Для-Дады/ps-два-перевода/index.html`.

## Goal

On the song page a reader can choose between two kinds of English translation:

- **Poetic**: reads like a song. Today this is the official translation from the lyrics page.
- **Literal**: follows the words and their order. For study.

Every translation carries its origin. A literal translation nobody on the team has checked is never shown as authoritative.

## What exists today

- The translation is read in the `ReadingStrip` card at the bottom of the Lyrics panel (not in Commentary). It follows the stanza at the reader's eye, or shows the whole text when it cannot be tied to stanzas honestly.
- Source: `songs.english_meaning` (5015 of 5018 songs). Free, idiomatic translation. Line counts equal lyric line counts in only 166 songs; 91 songs hold two official versions joined by a `-----` line.
- `songs.central_idea` exists for 40 songs (Commentary panel). Plain-language explanations: none. Word glosses in the app: none.
- Other languages are machine translations cached on demand and labelled "Machine-assisted".
- User choice lives in `stores/songPageStore.ts` (`translationOn`, `translations` = languages, `stripExpanded`). There is no kind setting.

Candidate sources for the literal kind:

| Source | Songs | Notes |
| --- | --- | --- |
| Dada's study pages (`ps-perevody`, Notion) | 9 with line translations (7 complete), 46 with word glosses | Authoritative after Dada's explicit check (`RULES.md`). |
| Sarkarverse line-by-line English | 3915; 3661 match the app's lyric lines at 80% or more, 182 partly, 72 not | Unchecked by us. Match by line text, never by song number alone. Use is permitted by Dada (2026-11-07). |
| Nothing | about 1100 songs have no literal candidate | Empty state with an offer to contribute. |

## Data model

One new table, `song_translations`. One row per translation. Kind, language and version are values, not columns on `songs`.

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | uuid | primary key |
| `song_id` | fk `songs.id` | the song |
| `language` | varchar(12), default `en` | |
| `kind` | `poetic` or `literal` | |
| `position` | smallint | order among rows of one song, language and kind; 0 is shown first |
| `segments` | jsonb | `[{"from":0,"to":1,"text":"...","doubt":null}]`, 0-based inclusive indexes of the Roman lyric lines as the app draws them (repeats included) |
| `alignment` | `whole`, `stanza` or `line` | derived from `segments` |
| `plain_text` | text | for search |
| `text_hash` | char(64) | for idempotent import |
| `author_kind` | `official`, `team`, `member`, `import` | |
| `author_label`, `member_id`, `is_anonymous` | | who is credited |
| `source_key`, `source_ref`, `credit_line` | | `official-lyrics-page`, `dada-notion`, `sarkarverse`, `member`; URL or page id; the line readers see |
| `license_note` | text | internal basis for use (date, who allowed) |
| `trust` | `unchecked`, `reviewed`, `verified`, `official`, `machine` | drives the label shown to readers |
| `status` | `draft`, `pending`, `published`, `rejected`, `archived` | |
| `reviewed_by`, `reviewed_at`, `verified_by`, `verified_at`, `rejected_reason` | | review trail |
| `doubts` | jsonb | `[{"line":3,"note":"..."}]`; carries Dada's extraction flags |
| `replaces_id`, `based_on_id`, `published_at`, timestamps | | versioning |

Rules the schema enforces or the code keeps:

- CHECK: `kind = 'literal'` is not allowed with `trust = 'machine'`. A machine literal translation cannot exist.
- Segments are placed by a person. Code never splits or joins a translation on its own. A translation without marking is one segment over the whole song.
- Unique key for import: (`song_id`, `language`, `kind`, `source_key`, `source_ref`, `position`).
- Index on (`song_id`, `language`, `kind`, `status`, `position`).
- Editing a published row creates a new row (`replaces_id`) and archives the old one. A verified row is never changed in place.
- Original text is not corrected. A typo in an official text is marked `[sic]`, not fixed.
- `songs.english_meaning` is not changed. The import reads it.

Reader labels from `trust`: official is "Official"; verified is "Checked"; reviewed is "Read by an editor"; unchecked is "Not checked yet" (amber, shown in the collapsed card too); machine is "Machine-assisted" (poetic, non-English only, as today).

Later: a `song_translation_reports` table (like `song_chord_reports`) and an offers table for a daily allowance.

## Flow

1. Team members publish at once. Members propose; a proposal is `pending` until the team approves (maximum `reviewed`). A required checkbox says the text is the member's own or used with permission.
2. `verified` is a separate step done only by a named verifier (today Dada).
3. Rejection stores a reason the author can see. Restore is possible.
4. Edit of published text creates a new version; the old one is archived.

## API sketch (pattern of `song_chords`)

- `GET /song-translations/songs/{song_id}?language=en`: published rows, with ETag.
- `GET /song-translations/availability?language=en`: which songs have which kind.
- `GET /songs/{number}`: add `translation_kinds`, for example `{"en":{"poetic":"official","literal":"unchecked"}}`.
- `POST /song-translations`, `GET /song-translations/mine`, `PUT` and `DELETE /song-translations/{id}`, `POST /song-translations/{id}/report`.
- Admin: `GET /admin/song-translations/review/queue`, `POST .../review/{id}/approve|reject|restore|verify`, `POST /admin/song-translations/import?dry_run=1`.

Migration: the next free number must be re-checked right before creating it (`ls apps/api/alembic/versions | tail -3`). At the time of writing the head on disk is `0045_author_claims`, so this would be `0046_song_translations`. Other branches add migrations in parallel.

## Import from the corpus

1. Official: split `english_meaning` on `-----` (positions 0 and 1), `trust=official`. The 166 line-aligned songs get `alignment=line`, the rest `whole`.
2. Dada's line translations (9 songs): map Notion lines to app lines by text, store `extraction_flags` as `doubts`. Stays `draft` until Dada says yes per song.
3. Sarkarverse: only after Dada decides. Match by line text; at least 80% of lines match goes to an automatic queue, 50 to 80% to a manual queue, below that is skipped with a report. `trust=unchecked`, credit line decided by Dada.
4. Dada's own whole-page versions (28 versions in 24 songs): queue with kind undecided; Dada classifies each.
5. No machine literal translations are created.
6. Import is idempotent and never overwrites rows the team has edited.

## App behaviour (recommended variant: switch in the reading strip)

- `songPageStore` gets `translationKind: "poetic" | "literal"` (persist version 2 to 3, default `poetic`). One choice per device.
- A `Segmented` "Poetic | Literal" sits in the strip card header; a matching row is added to the Aa popover before the Pronunciation row.
- If the remembered kind is missing for a song, the other kind is shown with the note "No literal translation yet. Showing Poetic". The stored choice is not reset.
- A missing kind keeps its segment tappable and shows an empty state with "Show the poetic one" and "Offer a literal translation".
- "Details" opens a sheet with kind, language, status, source, credit and other versions.
- Accessibility: radiogroup, 44px targets, provenance in words not only colour, polite live region on change.
- The pinned stage is not touched; the card is an overlay.

Search: index `plain_text` of published rows with the kind as metadata; unchecked rows with lower weight (open decision). The Pronunciation chip and button are unaffected.

## Open decisions

Whether the official translation is labelled "Official" (proposed) or "Poetic"; default kind (proposed: poetic); whether and how to show unchecked Sarkarverse text and its credit line; classification of Dada's 28 own versions; who may verify; when members may propose; handling of the 91 second official versions; wording of the labels in en/ru/es.
