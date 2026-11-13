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

## Comments (decision of Dada, 9 November 2026: they stay)

A comment stays when its author deletes the account, under the name the person had, the same way
a recording stays under its author's name.

How it works:

- `song_comments.member_id` and `recording_comments.member_id` are nullable and `ON DELETE SET NULL`
  (migration `0065_comments_survive_account_deletion`). Both tables also have `author_name`
  (up to 80 characters).
- `DELETE /v1/members/me` (`delete_member_data`) calls `keep_comments_under_name` (`app/services/comment_authors.py`)
  before the account row goes. It copies the display name into `author_name` for every NAMED
  comment, top-level and replies. After that the database sets `member_id` to null.
- An anonymous comment stays anonymous: it gets no name and is shown as before.
- Replies hang under their parent as before (`parent_id` is still `ON DELETE CASCADE`): deleting
  a person does not delete the thread under their comment. Deleting the parent comment itself
  (a moderator action, not an account deletion) still deletes the replies.
- The person is no longer linked: the app shows the name as plain text, no profile link, and the
  author cannot be notified about replies (the reply notice is skipped when the addressed comment
  has no account).
- Admin lists show `author_id: null` and the stored name.

What the person is told: the confirm dialog (`profile.delete.body`, en/ru/es; ru/es unreviewed in
`locales/review.json`) and the privacy page say that comments stay under the name.

Limits, said plainly:

- Existing rows are not touched by the migration. Comments written before the deletion keep
  their normal link until the account goes.
- A person who wants one comment gone must delete it before deleting the account (comment menu),
  or write to the team. There is no "delete my comments too" switch yet.
- Migration tests run on SQLite. PostgreSQL was NOT checked: run `alembic upgrade head` on a
  copy of the production database before the deploy. Downgrade deletes the comments that lost
  their account, because the old schema cannot hold them.

## Sign in with Apple (App Store 5.1.1(v))

When the member signed in with Apple and the server holds an Apple refresh token for them, deletion also calls Apple's revoke
endpoint after the account is gone. Apple trouble never blocks the deletion. See `docs/apple-token-revocation.md`.

## After deletion

The sign-in provider (Google, Apple, e-mail) still knows the person, so signing in again makes a
new empty account. No old data comes back.

## Privacy page

`apps/web/app/privacy/page.tsx` has a new paragraph that describes the behaviour above. It is
marked "нужна проверка владельцем" on the page; the policy itself was not changed.
