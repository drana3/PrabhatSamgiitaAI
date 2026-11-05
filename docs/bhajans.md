# Kiirtans and Bhajans (recordings with a kind)

A Bhajan is not a second system. Kiirtans and Bhajans are ONE list of audio recordings; each has a `kind`:
`"kiirtan"` (group chanting) or `"bhajan"` (a devotional song). Same player, same queue, same save, share,
report and review flow. Songs of Prabhat Samgiita stay separate (they have lyrics, versions and a catalog
number). Bhajans have no lyrics for now. Visible spelling: "Kiirtan" with two i's, plural "Kiirtans";
"Bhajan", plural "Bhajans". Code identifiers and routes keep `kirtan` (`kirtan-player`, `kirtanStore`).

## Model

| Field | Kiirtan | Bhajan |
| --- | --- | --- |
| `kind` | `kiirtan` | `bhajan` |
| `type` | `bnk`, `lila`, `festival`, `other` | `morning`, `evening`, `devotional`, `other` |
| `author` | performer or group | same; may be empty (unknown) |
| other fields | `title`, `durationSec`, `audioUrl`, `thumbnailUrl`, `addedBy`, `status`, `addedAt`, `plays` | same |

`other` exists in both kinds, so a type is always read together with the kind. Code: `lib/kirtan/types.ts`
(types), `lib/kirtan/kind.ts` (every visible word of a kind: `kindLabel`, `kindTag`, `kindSubtitle`, filters),
`lib/kirtan/tone.ts` (gradients per type; palette colours only, see `ui-colour-system.md`).

Old stored data: the persisted store `prabhat-kirtan` went from version 1 to 2. `lib/kirtan/migrate.ts` gives
every stored submission `kind: "kiirtan"` and repairs a type that does not belong to its kind.

## Where the kind shows

- Kiirtan tab chips: All, Kiirtan, Bhajan, then Saved, Downloaded, My uploads. The first three filter every
  shelf and list (the tab bar label stays "Kiirtan"). Shelves "Bhajan of the day" and "Bhajans for every hour"
  appear under All and Bhajan, built from the same components as the Kiirtan shelves.
- Player: subtitle `Bhajan · <author>` (or `Bhajan · added by <who>` when the author is not a known artist),
  no lyrics. Mini-player pill, queue rows (`BHAJAN` tag), row menus, share text and "Playing from" use the kind.
- Add form: first field "What is it?" (Kiirtan or Bhajan); the type chips depend on the choice; the submission
  carries `kind`. My uploads rows carry a neutral `KIIRTAN` / `BHAJAN` tag.
- Artist page: lists both kinds of the author, each row tagged. Search: group "Kiirtans and bhajans";
  "bhajan" and "kiirtan" are searchable words that filter by kind (`bhajan morning`, `kiirtan priya`).
- Upload decision notifications say "Bhajan approved" / "Kiirtan approved" (`lib/notifications/serverKinds.ts`).

## Bulk loader (library on disk)

The bulk-load script (R2 storage, normalised AAC 128k, metadata table, pilot of 50 tracks first) reads the
kind from the folder name: a folder named `bhajan` (any case) gives `kind = bhajan`; every other folder gives
`kind = kiirtan`. The type comes from the file name or a sidecar CSV; when unknown it is `other`. Author is
left empty when unknown, and `addedBy` is `Ananda Marga team`.

## What the server needs (TODO(api))

1. One `recordings` table with a `kind` column (`kiirtan` | `bhajan`, default `kiirtan`), `type`, `author`,
   `title`, `duration_sec` (read from the file after upload), `audio_url`, `thumbnail_url`, `added_by`,
   `status` (`pending` | `approved` | `rejected`), `added_at`, `plays`. A check keeps `type` valid for `kind`.
2. Upload endpoint: signed URL or multipart; takes the metadata including `kind`; returns the stream URL.
   Team members and authors both upload (see the uploads policy); no automatic YouTube downloading.
3. Admin review queue: lists pending recordings with kind, plays the file, approves or rejects with a reason;
   the decision triggers the `upload` notification.
4. Catalog, search (`kind` filter and word), artists, play counts and the report endpoint take the same field.

## Built vs fixture

- Built and tested (vitest, `__tests__/kirtanKind.test.ts`): the kind model, labels, filters, migration, tones,
  submissions with kind, queue tags, share and notification copy, search by kind, tab chips and type cards.
- Fixture only (`lib/fixtures/kirtan.ts`, `TODO(api)`): the catalog. Four real sample Bhajans from the team's
  folder ("The sweetest word" 4:43, "Soon the day will dawn" 3:12, "Once there was a day" 4:20, "Many Thousand
  Years Ago" 9:52) with their real lengths, empty author, added by "Ananda Marga team"; their types are a preview
  guess. Three more Bhajans by the sample artists are made up so the shelves and the artist page show both kinds.
- No audio plays for the samples: the web preview's demo engine only simulates playback (a clock), so
  `audioUrl` stays `null` until the upload API serves the files. The mp3 files are not in git.
- Still missing: sign-in before sending, duplicate check on the server, takedown path, Bhajan lyrics, downloads.
