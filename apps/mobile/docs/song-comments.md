# Song comments

A block at the end of the song page (`components/song-page/Comments.tsx`, after "About this song"): "If you have a
story, an inspiration or a realization about this song, you can share it here", a text field, a **Share anonymously**
checkbox (off by default) and the members' comments, newest first. Guests read the list and see a sign-in prompt
instead of the field.

## API (`apps/api`)

New files: `app/models/song_comments.py`, `app/schemas/song_comments.py`, `app/services/song_comments.py`,
`app/api/v1/song_comments.py`, migration `alembic/versions/0030_song_comments.py`, tests `tests/test_song_comments.py`.
Two additive lines in `app/api/v1/router.py`, two in `app/models/__init__.py`.

| Method and path | Who | What |
| --- | --- | --- |
| `GET /api/v1/song-comments/songs/{song_id}?limit&offset` | everyone | published comments of a song (1 to 5018), newest first, `limit` 1 to 50 (20), `has_more` |
| `POST /api/v1/song-comments/songs/{song_id}` | signed-in member | `{body, is_anonymous}`; live at once; 201 |
| `DELETE /api/v1/song-comments/{id}` | the author, or the team | the author deletes for good; the team removes (status `removed`, reason kept) |
| `POST /api/v1/song-comments/{id}/report` | anyone | `{reason: offensive/spam/private/other, note?}`; one report per person |
| `GET /api/v1/song-comments/reported` | the team | reported comments, most reported first, WITH the author |

Tables: `song_comments` (id, song_id 1..5018, member_id, body 1..2000 characters, is_anonymous, status
`published`/`removed`, reports_count, removed_reason/at/by, timestamps) and `song_comment_reports`. Migration 0030 is
written by hand and safe to run twice (the app also runs `create_all` at start).

Rules (mirrored by `lib/songComments/rules.ts`): text trimmed, spaces collapsed, at most one blank line in a row,
at most two links, no identical text twice by one member on one song. Limits for non-team members: 10 comments an
hour (in-process, per API instance) and 20 in 24 hours (counted in the database, removed ones count; error code
`comment_daily_limit`). The team (`is_admin`, `is_super_admin` or an owner email, the same test as the recordings:
`services.recordings.is_team_member`) is not held to the daily limit and can remove any comment.

## Anonymity guarantee

* The public answer (`SongCommentOut`) has **no member id, no email**, and for an anonymous comment `author` is
  `null`: no name, no avatar. Nothing else in the answer is derived from the account (the comment id is a random UUID).
  `mine` is true only for the signed-in author asking about their own comment (so they can delete it); every other
  reader gets `false` for it. The list is sent `Cache-Control: private, no-store` because it depends on who asks.
* A test posts an anonymous comment and walks the JSON the guest, the author, another member and the team receive:
  the author's id (dashed and plain), name, email and avatar URL appear nowhere.
* A named comment shows the account's display name and avatar. A display name that contains an `@` is shown as
  "Member" (an address is never a name).
* **Anonymous means anonymous to other members, not to the team.** The database keeps `member_id` (the author must be
  able to delete their comment, and the team must be able to deal with abuse), and `GET /song-comments/reported`
  shows the author of a reported comment to the team. The app says so under the checkbox: "The Prabhat Samgiita team
  can still see who wrote a comment if it is reported." If the project wants true unlinkability this has to change
  (it would also remove the author's ability to delete).
* If the account is deleted its comments are deleted with it (`ON DELETE CASCADE`).

## Moderation

Publish first, review after, like the Kiirtan recordings. Anyone can report (guests by device bucket, members by
account, rate limited). Reports are stored and counted; **no comment is hidden automatically** (auto-hiding would let
a few people silence anyone). The team reads `GET /song-comments/reported` and removes with
`DELETE /song-comments/{id}` (body `{"reason": "..."}`); the app has a "Remove as team" action for the team. There is
no screen for the reported list yet and no notice to the author of a removed comment (the recordings have both).

## Mobile

* `lib/songComments/`: `rules.ts` (the draft rules, relative time, who may write), `state.ts` (the list reducer),
  `remote.ts` (the real API client, same error classes as `lib/kirtan/remote.ts`), `mock.ts` (in-memory backend),
  `backend.ts` (picks one). `components/song-page/useSongComments.ts` wires them to React.
* Words: `locales/songComments.ts` (en, ru, es), spread into `locales/en.ts`, `ru.ts`, `es.ts`. Russian and Spanish
  are not yet read by a native speaker (not added to `locales/review.json`).
* With `EXPO_PUBLIC_MOCKUP_DATA=1` (web preview) the section talks to an in-memory backend: two sample comments per
  song, new ones live until the page is reloaded, and a visible note says so. A real build never uses it.
* Guests see the list and a "Sign in" prompt. A signed-in member whose build cannot prove it to the server (no member
  proxy key) sees "Sharing comments is not available in this build yet".
* The checkbox starts off each time the page opens and is never remembered. The text a failed post leaves is kept.

## Tests

`apps/api`: `pytest tests/test_song_comments.py` (23 tests: anonymity, posting rules, paging, delete, team removal,
reports, limits, migration on SQLite). `apps/mobile`: `npx vitest run __tests__/songCommentsRules.test.ts` (draft
rules, relative time, reducer, wire mapping, the client against a fake server, the in-memory backend).
`apps/api/tests/test_recording_duplicates_migration.py` was changed in one line: it asserted that 0029 is the head.

## Not verified

* Nothing was run against PostgreSQL: the migration, the `length(body)` check and the join were tried on SQLite only.
  Try migration 0030 on a copy of the database before a deploy.
* No device. The web preview was checked headlessly at 390, 768 and 1440 px, light and dark, in mock mode. The guest,
  offline, error and "load more" states are covered by logic tests but were not seen on screen. The on-screen
  keyboard over the field on iOS/Android was not tried.
* The hourly brake is per API process (as for the recordings); with several instances it is looser.
* Nothing is deployed. The real API and the sign-in path were not exercised from the app.
* `expo lint` could not run here (the ESLint config fails to load); TypeScript reports no error in the new files
  (the repository has many older ones).
