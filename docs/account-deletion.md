# Account deletion: what goes and what stays

Endpoint: `DELETE /api/v1/members/me` (the app's "Delete account" and the web page
`/delete-account` both end here). Pinned by `apps/api/tests/test_account_deletion.py`, which runs
on a database with foreign keys switched on so the cascades are really exercised.

## Decision (Dada)

Recordings stay in the library with the author name. Personal data is deleted.

## What is deleted

| What | How |
|---|---|
| The account row: e-mail, display name, phone, avatar, language, country | row deleted |
| Password hash | `user_credentials`, cascade |
| Every signed-in device: session rows and refresh tokens | explicit delete in `delete_member_data`, and cascade; the access token then fails because its session row is gone |
| Push tokens, push switches, push history | cascade (push tables are not in the test) |
| Favourites, playlists, AI chat memory, interest profile, quiz attempts | cascade |
| The author page, its photo, links, stats snapshots, reports it received | `author_profiles.erase_member`; the old address answers 410 and is held back for a while so nobody can take it over |
| Raw listening rows (`play_events`, `song_play_events`) | `author_stats.erase_listener`; they are keyed by a short salted hash, never by the account id |
| Reports the member filed | the reporter link is set to null, the report text stays (it is about someone else's content) |

## What stays

| What | Why |
|---|---|
| Recordings the member uploaded | `recordings.author_id` becomes null (`ON DELETE SET NULL`); `recordings.author` and `recordings.added_by` are plain text copies of the name and stay. Decision above. |
| Play counters and daily totals | not personal data, no account link |
| Takedown notices and counter-notices | a legal record: `takedown_requests.sender_member_id` is set to null, but the sender's name and contact details written in the notice stay with the case (see `docs/takedown-process.md`). Open question for the owner and a lawyer: how long to keep them. |

## Comments (current rule, not a decision)

Comments are deleted together with the account: `song_comments.member_id` and
`recording_comments.member_id` are `ON DELETE CASCADE`, and replies hang under their parent with
cascade too. So deleting an account also deletes the replies it wrote under other people's
comments, and nobody else's comment is touched.

Open question for the owner: should comments instead stay under the name, like recordings do?
That would need the foreign keys changed to `SET NULL` and a stored name on the comment. It is a
product and privacy choice, so nothing was changed.

## After deletion

The sign-in provider (Google, Apple, e-mail) still knows the person, so signing in again makes a
new empty account. No old data comes back.

## Privacy page

`apps/web/app/privacy/page.tsx` has a new paragraph that describes the behaviour above. It is
marked "нужна проверка владельцем" on the page; the policy itself was not changed.
