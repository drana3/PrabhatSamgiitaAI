# The team's desks (phone)

Three screens for the team (moderators and admins), opened from the Upload hub, in the rows under "Author claims". A
member who is not on the team never sees the rows; the server checks every call again (`get_team_member`).

| Desk | Screen | Server | Rules and design |
| --- | --- | --- | --- |
| New words | `app/team-words.tsx` | `GET /recordings/value-suggestions`, `POST /recordings/value-suggestions/{id}/decision` (already existed) | `docs/kiirtan-recording-info.md`, "Add your own" |
| Takedown requests | `app/team-takedowns.tsx` | `/team/takedowns...` (new, `app/api/v1/team_queues.py`) | `docs/takedown-process.md` |
| Play checks | `app/team-play-flags.tsx` | `/team/play-flags...` (new, same file) | `docs/play-fraud.md` |

Shared pieces: `components/team-desks/DeskFrame.tsx` (frame, loading / offline / error / denied line), `hooks/useDeskLoad.ts`,
`lib/teamDesks/` (`rules.ts` pure rules, `remote.ts` calls, `types.ts`), words in `locales/teamDesks.ts` (Russian and Spanish
start unreviewed, `locales/review.json`). Tests: `apps/mobile/__tests__/teamDesks.test.ts`, `apps/api/tests/test_team_queues.py`.

## Why new `/team/...` routes

`/admin/takedowns` and `/admin/play-flags` answer to the admin API key, which the app never holds. The `/team/...` routes
call the same services (`services/takedowns.py`, `services/play_fraud.py`) behind the team-member gate the other review
screens use. No rule is repeated; the audit trail (`decided_by`, `reviewed_by`) holds the team member's name or e-mail. The
admin routes are unchanged.

## What each desk does

- **New words.** A card per word: kind, the word, who wrote it first (`first_by`), on how many recordings and by how many
  people, a hint when it looks like a listed value. Accept, Merge into a listed value (a searchable picker; the hint is
  preselected), Reject (asks once more). The list of listed values comes with each word (`merge_targets`, English names).
- **Takedown requests.** Tabs: Waiting, Taken down, Waiting time, Finished. A card shows the claimant, the claim text, the date,
  the status and a link to the recording. Actions follow the server: Take down now (asks once more; hides the recording, keeps
  the record, blocks the file, tells the uploader), Reject (a reason), Link the recording (paste an address when the sender's
  text had no id), Pass a counter-notice to the claimant, Restore (after the waiting time, or "claimant withdrew"), Close.
- **Play checks.** Days when a recording's plays are far above its usual: counts, the rule's reason, what is left out of the
  numbers. "Real" clears it, "inflated" keeps the plays out for good, "take back" undoes a mistaken "inflated".

## What is missing

- **Accounts in the play checks.** Only recording-days are flagged (`play_flags`). No account or listener is listed on
  purpose: the table holds no listener key, client key or address (`test_a_flag_holds_no_listener_or_address_data`). If the
  owner wants "accounts that play suspiciously" it needs a new, privacy-reviewed design first. The screen says so in its empty
  state.
- **Moods.** There is no list API for mood confirmations: `GET /recording-moods/confirmed` returns recording ids with their
  confirmed moods (for the search menu), and the votes and suggestions are only readable one recording at a time
  (`GET /recording-moods/recordings/{id}`). A summary screen needs a "moods waiting for a decision" endpoint first. Not built.
- **Restore without a counter-notice.** The server restores from a forwarded counter-notice only (`services/takedowns.restore`).
  A rights holder who withdraws before the uploader answers has no restore button; that is a policy change in
  `docs/takedown-process.md`, not a screen change.
- **The two letter templates** (`GET /admin/takedowns/{id}/letters`) are not on the phone yet.
- **Web preview.** The desks have no in-memory stand-in (the other review desks have one): in the web preview they show the
  error state.
- Server refusals that carry a reason (the waiting time, a missing link) are shown as the server wrote them, in English.
