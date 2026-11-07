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
| `DELETE /api/v1/song-comments/{id}` | the author, or the team | the author deletes: it vanishes for everybody and the text is wiped, the row stays marked `removed` by `author` (see "Deleting"); the team removes (status `removed`, text and reason kept) |
| `POST /api/v1/song-comments/{id}/report` | anyone | `{reason: offensive/spam/private/other, note?}`; one report per person |
| `GET /api/v1/song-comments/reported` | the team | reported comments, most reported first, WITH the author |

Tables: `song_comments` (id, song_id 1..5018, member_id, body 1..2000 characters, is_anonymous, status
`published`/`removed`, reports_count, removed_reason/at/by, timestamps) and `song_comment_reports`. Migration 0030 is
written by hand and safe to run twice (the app also runs `create_all` at start).

Rules (mirrored by `lib/songComments/rules.ts`):

* Text is trimmed, spaces are collapsed, at most one blank line in a row.
* **Invisible characters are removed** (QA-010): bidi overrides and isolates (U+202A to U+202E, U+2066 to U+2069), the
  direction marks, zero-width space, word joiner, byte-order mark, soft hyphen and the rest of the Unicode "format"
  class. The two joiners (U+200C, U+200D) stay only next to an Indic letter (U+0900 to U+0DFF) or an emoji, because
  there they shape the text (Devanagari and Bengali conjuncts, emoji sequences). The app counts characters after this
  cleaning, so the counter shows what will be stored.
* **At most two links** (QA-016). `https://...`, `www....` and **bare addresses** such as `example.com` or
  `shop.example.org/page` all count. Only a list of well-known endings is matched (`com`, `org`, `net`, `io`, `co`, ...
  see `_BARE_TLDS`), so ordinary writing ("yes.No", "e.g.") is never taken for a link; an e-mail address is not a link.
  A list cannot be complete: an address with a rare ending still gets through.
* **No identical comment twice** by one member on one song (QA-017). "Identical" ignores case, spaces, punctuation and
  invisible characters (`same_text_key`: letters, marks and digits, NFKC, case-folded). Vowel signs are kept, so two
  different Hindi words are never the same. A comment you deleted does not block writing it again.

There is **one** brake against flooding and no daily or hourly allowance (changed in the replies round): at most
**5 posts a minute** per member (team: 30), counted over the last 60 seconds and shared by song comments, recording
comments and replies, so using several doors does not multiply it. The answer is 429 and the app says "up to 5 comments a
minute". The team (`is_admin`, `is_super_admin` or an owner email, the same test as the recordings:
`services.recordings.is_team_member`) can remove any comment.

* **A refused post costs nothing** (QA-009): the text is validated, and the comment a reply answers is checked, before the
  minute brake is counted, so an empty post, a link flood or a reply to a missing comment does not use up the five.
* The removed rows are still kept, only because the author's delete leaves a tombstone and the team keeps the text.

### Limits that are only as strong as one process (QA-024)

The minute brake (and the report limits) live in `RateLimiter`, a small in-memory sliding window. It stops a script, not a
botnet: a restart of the API empties it, several instances do not share it, and nothing is stored. With the daily
allowance gone there is no database-counted limit on comments any more; the length, the two links and the duplicate rule
bound what one person can post. The report limits are keyed by `request.client.host`; behind a
reverse proxy that is the proxy's address unless the server is started with proxy headers trusted (for example uvicorn
`--proxy-headers` with `--forwarded-allow-ips` set to the proxy), so all guests would share one bucket. Nothing in the code
changed for this; if the API runs on several instances, move the limiter to a shared store (Redis) and set the proxy headers.

### Deleting (QA-008, QA-009)

* The **author** deletes their own comment, also an anonymous one. Its text is wiped. A top-level comment leaves a
  **tombstone** ("Deleted by the author", no text, no author, nothing to report) so the replies under it keep their place;
  a reply just goes. The row keeps `status = removed` and the reserved marker `"\x1fauthor"` in `removed_by` (QA-059):
  a control character in front, so no display name can ever equal it, and `team_removed_by()` strips control characters
  from a team member's name. Deleting it a second time answers 404, like any missing comment.
* If the **team already removed** the comment, the author's delete changes nothing: same answer (204), text, reason, who and
  when stay for the record. (Before, the author could wipe it.)
* The **team** removes any comment; the text is kept, with a reason, who and when. A removed comment cannot be removed again.

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
  shows the author of a reported comment to the team. The app says so, plainly, under the checkbox (QA-011):
  "Anonymous means hidden from other members, not from the team: the Prabhat Samgiita team can see who wrote an
  anonymous comment." (Russian and Spanish say the same, `songComments.as.team`.) The promise is limited to other members
  on purpose. If the project wants true unlinkability this has to change (it would also remove the author's ability to
  delete). Open caveat (QA-001, decision pending): the team check trusts an identity header that is protected only by the
  shared member proxy key in the app bundle, so anonymity towards the team is as strong as that key.
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

`apps/api`: `pytest tests/test_song_comments.py` (32 tests: anonymity, posting rules, invisible characters, bare-domain
links, disguised duplicates, paging, delete, team removal, reports, limits, migration on SQLite). `apps/mobile`: `npx vitest run __tests__/songCommentsRules.test.ts` (draft
rules, relative time, reducer, wire mapping, the client against a fake server, the in-memory backend).
`apps/api/tests/test_recording_duplicates_migration.py` was changed in one line: it asserted that 0029 is the head.

## Not verified

* Nothing was run against PostgreSQL: the migration, the `length(body)` check and the join were tried on SQLite only.
  Try migration 0030 on a copy of the database before a deploy.
* No device. The web preview was checked headlessly at 390, 768 and 1440 px, light and dark, in mock mode. The guest,
  offline, error and "load more" states are covered by logic tests but were not seen on screen. The on-screen
  keyboard over the field on iOS/Android was not tried.
* The hourly brake is per API process (as for the recordings); with several instances it is looser (see "Limits that are
  only as strong as one process").
* The bare-address list is a list: a link with a rare ending is not counted. The invisible-character list is the Unicode
  "format" class, not every invisible look-alike (a Hangul filler or a Braille blank still gets through).
* Nothing is deployed. The real API and the sign-in path were not exercised from the app.
* `expo lint` could not run here (the ESLint config fails to load); TypeScript reports no error in the new files
  (the repository has many older ones).

## Replies and the review calls

Replies (one level, `parent_id`, the "to Name" line, 50 per conversation, how the lists count) are in
`docs/comment-replies.md`. The team's calls on comments: `GET /review?filter=reported|removed`, `POST /{id}/keep` (the
reports were looked at, the comment stays) and `POST /{id}/restore` (a team removal was a mistake; an author's own delete
stays). The phone's review desk (`app/team-review.tsx`) uses them.
