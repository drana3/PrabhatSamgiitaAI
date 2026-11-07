# Playlists from an event (Kiirtan sets)

A concert, a retreat or a satsang goes up as ONE playlist: a title, an approximate date (year and month), the place,
an optional cover picture and the recordings in order. Each recording is still a normal recording of the library (same checks, same duplicate rules,
same reports); the playlist only groups them and gives them an order. Entry point in the app: "Upload a playlist from
an event" on the add screen (`/upload-set`), and "My event playlists" (`/my-sets`).

Related: `docs/kiirtan-publishing.md` (the five types, languages and dances, duplicates, limits of single uploads),
`docs/player-visibility.md` (the three new routes are listed there).

## Model

Server (`apps/api`, migration `0032_recording_sets_and_categories`):

- `recording_collections`: the playlist. `id` (the phone makes it, so a create sent twice is the same playlist),
  `owner_id`, `title`, `description`, `place`, `event_year`, `event_month` (migration `0041`; the month may be empty),
  `starts_on` (NOT NULL, filled from the year and month: the first of the month, or 1 January), `ends_on` (old
  column, kept, not shown), `cover_version`, defaults (`default_kind`,
  `default_language`, `default_language_other`, `default_dance`), `tracks_expected`, `finished_at`, `status`
  (`active` or `removed`), removal fields.
- `recordings.collection_id`, `position` (1 first), `recorded_on`: a track says which playlist it is in, its place and
  its own date (the playlist's first day when empty).
- State is DERIVED, never stored: `removed` (the team took it down), `draft` (nothing live yet), `uploading` (the last
  file was not sent yet: `finished_at` empty and `tracks_expected` above the live count), `published`.
- A track inherits kind, language and dance from the playlist only when it did not send its own; the category rules
  are then checked on the result (a Bhajan or a Spiritual song without a language, or a Dance music without a dance, is a 422 even
  inside a playlist).

Phone (`apps/mobile`):

- `lib/kirtan/sets.ts`: pure model and loop (`SetDraft`, `SetTrack`, validation, order, `runSet`, `restoreDraft`).
- `stores/uploadSetStore.ts`: the drafts, kept on the phone (AsyncStorage `prabhat-upload-sets`) plus the last 20
  published sets (`archive`). The network sits behind `SetPorts` (`lib/kirtan/setPorts.ts`), so tests give it a fake.
- `lib/kirtan/remoteSets.ts`: the API client. `lib/kirtan/setView.ts`, `setPage.ts`: view models.
- Screens: `app/upload-set.tsx` (the flow), `app/recording-set/[id].tsx` (the page), `app/my-sets.tsx` (the list),
  `components/kirtan/sets/SetTrackRow.tsx`, `components/kirtan/add/KindFields.tsx` (language and dance fields).
- Strings: `locales/recordingSets.ts` (en, ru, es).

## The flow (upload-set)

1. **Files.** Pick many audio files (system picker; the browser has a multi-file input). A file already in the set
   (same name and size) is left out, and so is every file beyond the room left; the screen says how many.
2. **Details.** Title of the event (required), place, approximate date as a YEAR (required) and a MONTH (optional,
   "Month not known"), performer or group (optional, only for kinds that have a performer; empty means the uploader's
   name), an optional cover picture, and the defaults for the tracks: type, and the language or dance that
   the type needs. Errors are inline and the step does not move on until they are fixed.
3. **Tracks.** The list in the order the files were picked, with "Sort by file name" (numbers read as numbers: "2"
   before "10"). Each track has an editable title, up and down buttons, a remove button, its own date, its own type,
   and its own language and dance. A track without its own value inherits the playlist's. "Apply to all" sets the
   language or the dance for every track that can still be sent.
4. **Send.** The content rules are confirmed ONCE for the whole set (not once per file); if the person already agreed
   to this version of the rules, the checkbox is replaced by the date they agreed. Tracks go one after another, each
   at its place in the list, with a progress bar. The end shows "N of M are live" and, for each track that did not go,
   its reason and its own "Try again".

The button is disabled and the reason is shown when: the details are wrong, the rules are not confirmed, nothing waits,
or a waiting track misses its title, language or dance (`startBlock`).

## Resuming and partial success

- The draft is saved on every change. Closing the app, losing the signal or leaving the screen never loses it:
  "Unfinished playlists" brings it back to the step it was at.
- Sending is **resumable**: the playlist is created once (same id, so a second create finds the same one), a track that
  is live is never sent again (it keeps its server id), and "Continue" sends what is left.
- A track that was going when the app was killed goes back to waiting. If the file did reach the server, the server
  answers "already yours" and the track shows as such.
- No connection stops the run; the track that was going and the rest stay **waiting** (not failed), and the screen says
  there is no connection. A failed file (server error, bad format, too large) does not stop the others. "Try again"
  retries one track; "Try all again" retries every failed one.
- A track that sounds like something in the library parks with the usual question ("different performance?"); the rest
  carries on.
- After the last track settles, the live order is sent (`PUT /order`) and, if nothing is left to do, `POST /finish`
  moves the playlist from `uploading` to `published`. A set with a failed track stays `uploading` until the track is
  retried or removed.

## Editing later (page of the playlist, owner only)

"Manage this playlist": rename (`PATCH`), move a recording up or down (`PUT /order`), take a recording out of the
playlist (`DELETE /tracks/{id}`; the recording stays in the library on its own), "Add recordings" (back to the flow,
same set id), and delete the whole playlist with a confirm that asks what to do with the recordings:
`?tracks=keep` (default) or `?tracks=remove` (they leave the library too; says it cannot be undone).

## Public page

Cover (when there is one), title, month and year, place, "Added by", the number of recordings, description, "Play all" (the whole list goes to the one
player with the playlist title as "Playing from"), tapping a row plays from there, and Share (text only: title, count,
place and month/year). Not found, loading, failed (with "Try again") and empty states have their own text.

## Limits and why

| Limit | Value (setting) | Why |
| --- | --- | --- |
| Recordings in one playlist | 60 (`RECORDING_SET_MAX_TRACKS`); team 200 (`..._TEAM`) | A concert is 20 to 40 tracks. The cap keeps a page and its order call small; the team keeps long recorded events whole. |
| Playlist tracks a member can add in a day | 60 (`RECORDING_SET_TRACKS_PER_DAY`), counted from the database | Apart from the 20 single uploads a day: one retreat is more than 20 files, and the single-upload cap would make an honest event impossible. It still stops a bot or a mistake from filling the library. |
| Playlists a member can start in a day | 3 (`RECORDING_SETS_PER_DAY`) | A playlist is a public page. Three events a day is already more than anyone attends. |
| Started playlists with no live recording at once | 5 (`RECORDING_SET_EMPTY_DRAFTS`) | Stops piles of empty pages. |

The team (`is_team_member`) is exempt from the per-day limits and has the larger track cap. Over a limit the API answers
429 with `X-Error-Code: set_daily_limit` (tracks) or `set_start_limit` (playlists), or 409 `{"code": "set_full"}`;
the phone says so in plain words, keeps what did not go and stops the run (tracks wait for tomorrow). The phone caps the
list at 60 for everyone because it does not know the member is on the team (the API is the truth).

## Moderation

- Every track is a normal recording: a member can report it, the team can remove it (with a reason and a notice), and
  the usual report threshold applies.
- The team can take a whole playlist down with a reason (`POST /admin/recording-sets/{id}/remove`; every live track goes
  with it and the owner gets one notice) and bring it back (`/restore`). `GET /admin/recording-sets` lists them.
  A removed playlist shows its reason to the owner and is "not available" to everyone else.
- Not built: a screen in the admin area of the app for these three calls.

## Demo preview

With `MOCKUP_DATA` (the live preview) there is no server. The flow, the progress, the drafts and the page work on the
device and every call succeeds locally; the page says so for the owner controls ("Demo preview: changes stay on this
device"). Rename, reorder, take out and delete are server calls and are only offered where a server answered.

## Import script

`apps/api/scripts/import_kiirtan_library.py --folder DIR --set-title "..." [--set-date --set-end-date --set-place
--set-description]` (the playlist keeps only the year and month of `--set-date`) imports a folder as one playlist (the CSV is optional; the files go in file-name order; a CSV `date`
column gives a track its own day). `--category`, `--language`, `--language-name` and `--dance` are the defaults for
rows without their own; a row that misses its required language or dance fails alone. Same duplicate checks as the
app, dry run by default.

## Edge cases that are handled

- The same set id sent twice (app killed before the answer): the server returns the one that exists.
- A file picked twice, or two files with the same name and size: one track.
- The event date is a year and an optional month; the API refuses a year before 1900, a year or month ahead of today.
  A track's own date is read only as a real calendar day (`2026-02-30` is refused).
- Reordering while the run goes on: the position of a track is read from the list at the moment it is sent, and the
  final order is sent at the end, so a move made during the run is kept.
- Removing the last failed track finishes the set.
- Title, place and description lose zero-width and bidi-override characters (the same `strip_invisible` the comments
  use); a title that has nothing visible left is "Add a title.".
- A day of an event, and a track's own day, cannot be before 1900 (the floor of a recording's `year`) or after tomorrow.
- A track that names no `kind` takes the playlist's, and keeps the language it sent: a Spiritual or Bhajan playlist
  accepts `{language: "hi"}` without `kind`; in a Kiirtan playlist the language is still dropped.
- Deleting a playlist that has a track the team already removed: the track is detached and stays removed.

## Limitations (honest)

- **Cover picture:** one image, at most 300 KB, JPEG, PNG or WebP; the phone re-encodes it small (this drops the
  camera's GPS and other metadata) and the server checks the type and cuts out any metadata again
  (`app/services/image_clean.py`, same rules as an author's photo). It is sent after the playlist exists; if that fails
  the playlist still goes up and the person can add the cover later from the playlist page ("Manage this playlist").
- **Web reload:** in the browser a picked file is a blob address that does not survive a reload; such a track shows
  "file is gone", and the person removes it or picks it again. On a phone the file stays (cached copy).
- **Share is text only** (no link/deep link, no poster card).
- **The 60 cap on the phone** is not team-aware (see Limits).
- **No admin screen** for the playlist moderation calls.
- **Adding recordings that are already in the library** to a playlist (`POST /tracks`) exists in the API and the client
  but has no screen.
- **Postgres, real R2 and a real phone were not exercised**: API tests run on SQLite (the migration too), uploads use a
  fake storage and a fake network in the phone tests. Run migration 0032 on a copy of the production database first.
- The Russian spelling "Каушики" for Kaoshiki is not checked by a native speaker.
