# Kiirtans and Bhajans (recordings with a kind)

A Bhajan is not a second system. Kiirtans and Bhajans are ONE list of audio recordings; each has a `kind`:
`"kiirtan"` (group chanting) or `"bhajan"` (a devotional song). Same player, same queue, same save, share,
report and moderation flow (published at once, checked after: `kiirtan-publishing.md`). Songs of Prabhat Samgiita stay separate (they have lyrics, versions and a catalog
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

Old stored data: the persisted store `prabhat-kirtan` is at version 3. `lib/kirtan/migrate.ts` gives every stored
submission `kind: "kiirtan"`, repairs a type that does not belong to its kind, and maps the old statuses:
`approved` becomes `published`, `pending` becomes `failed` (it never reached the server, the person can send it
again), `rejected` becomes `removed`. `blockedAuthorIds` and `blockedNames` start empty.

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
- Upload notifications say "Bhajan published" / "Kiirtan removed" with the team's reason (`lib/notifications/serverKinds.ts`).
  A removal notice reaches the phone when the list of the person's uploads (`GET /recordings/mine`) is refreshed.

## Bulk loader (library on disk)

The bulk-load script (R2 storage, normalised AAC 128k, metadata table, pilot of 50 tracks first) reads the
kind from the folder name: a folder named `bhajan` (any case) gives `kind = bhajan`; every other folder gives
`kind = kiirtan`. The type comes from the file name or a sidecar CSV; when unknown it is `other`. Author is
left empty when unknown, and `addedBy` is `Ananda Marga team`.

## Publishing policy (publish first, check after)

Nobody waits for a review. A team member or an author who uploads gets the recording published at once; the team
checks after publication and removes what breaks the content rules, with a notice to the author (reason, how to
answer, how to upload a corrected version). Status on the phone: `uploading`, `published`, `failed`, `removed`.
The add form asks for sign-in, the box "I am the author or I perform this", and (once, again after a change of the
rules) "I agree to the content rules". Every recording has Report (copyright, offensive, wrong info, other) and
"Block this author"; the page `/content-rules` is reachable from the form, from Report and from a removal notice.
Full operating guide, store requirements and what still needs real infrastructure: `kiirtan-publishing.md`.

## Server (built, `apps/api`, not deployed)

1. `recordings` table with `kind`, `type`, `author`, `title`, `duration_sec`, `audio_url`, `thumbnail_url`,
   `added_by`, `author_id`, `status` (`published` | `flagged` | `removed`), `removed_reason`, `plays`, plus
   `reports`, `author blocks` and member `notices` (Alembic 0027).
2. Upload in three steps: signed target, bytes to R2 (or local disk in development), publish. Exact SHA-256 copies
   are refused, similar fingerprints only warn. No automatic YouTube downloading.
3. Admin queue (`new`, `flagged`, `removed`) with remove (reason is required), restore and reviewed.
4. Catalog, artists, play counts and the report endpoint take the same field.

## Built vs fixture

- Built and tested (vitest, `__tests__/kirtanKind.test.ts`): the kind model, labels, filters, migration, tones,
  submissions with kind and the publish-first life, queue tags, share and notification copy, search by kind, tab chips and type cards.
- Fixture only (`lib/fixtures/kirtan.ts`, `TODO(api)`): the catalog. Four real sample Bhajans from the team's
  folder ("The sweetest word" 4:43, "Soon the day will dawn" 3:12, "Once there was a day" 4:20, "Many Thousand
  Years Ago" 9:52) with their real lengths, empty author, added by "Ananda Marga team"; their types are a preview
  guess. Three more Bhajans by the sample artists are made up so the shelves and the artist page show both kinds.
- No audio plays for the samples: the web preview's demo engine only simulates playback (a clock), so
  `audioUrl` stays `null` until the upload API serves the files. The mp3 files are not in git.
- Built on the phone and the API: sign-in before sending, duplicate check, report, block, takedown with a notice.
- Still missing: a real bucket and deploy (`kiirtan-publishing.md`), the native file picker, Bhajan lyrics, downloads.
