# Comment replies, anti-flood and the team review desk

Applies to the song comments (`/api/v1/song-comments`) and the recording comments (`/api/v1/recording-comments`). One code path serves both: `apps/api/app/services/comment_threads.py` on the server, `components/comments/CommentsView.tsx`, `lib/songComments/*` and `lib/recordingComments/*` on the phone.

## Replies

* **One level.** A top-level comment has no `parent_id`. A reply has the top-level comment's id as `parent_id`. A reply to a reply is stored under the same top-level comment and also keeps `reply_to_id` (the reply it answers), so the app can say "to Name" (`reply_to` in the answer: the name, `null` for an anonymous reply, and `deleted: true` when that reply is gone).
* **Posting.** `POST` with `parent_id` set to the id of the comment or reply being answered. The target must be the same song or recording and the answered comment must be live (not removed, not an author's tombstone), otherwise 404. A conversation holds at most **50 live replies**: the 51st gets 409 with `X-Error-Code: comment_thread_full`, and the phone says to write a new comment instead.
* **Lists.** A page is made of top-level entries, newest first, each with all its live replies oldest first. `total` counts the top-level entries (tombstones included) and drives paging. `live_total` is the number to show ("N comments"): every readable comment, replies included, tombstones and replies under a team-removed comment excluded.
* **Deleting.** An author's delete of a top-level comment leaves a tombstone ("Deleted by the author"; no text, no author, nothing to report) and its replies stay under it. An author's delete of a reply just removes it. A team removal of a top-level comment hides the comment and its replies from readers. Report and delete work on replies like on comments; the duplicate-text rule is per conversation target.
* **Phone.** Under each comment: "Reply" opens an inline composer (the same box, with Cancel); a collapsed "N replies" toggle opens the replies, indented under a thin rule. A reply to a reply shows "to Name". A posted reply opens its conversation.
* **Notice to the author.** See "Notice to the author of the answered comment" below.

## Notice to the author of the answered comment

When somebody replies, the author of the comment that was answered gets a notice (kind `comment_reply`, one row in `member_notices`, written in the same transaction as the reply by `comment_threads.add_reply_notice`). The one told is the author of the comment the reply answers: the top-level comment, or, for a reply to a reply, that reply's author (the thread to open is still the top-level comment, `payload.parent_id`). Nobody is told about a reply to themselves, about a plain top-level comment, or when the answered comment is gone. A reply that is refused (404, 409, 429) makes no notice.

* **Anonymous repliers.** The notice never carries the name of an anonymous replier: `body` reads "Someone replied to your comment." and `payload.from_name` is `null`. The test walks the notice for the replier's id, e-mail and name.
* **Payload.** `song_id` or `recording_id`, `parent_id` (the thread), `comment_id` (the reply), `answered_id`, `from_name`. `title` and `body` are default English; the phone writes its own words.
* **Phone.** There is no push yet. `components/notifications/ReplyNoticeSync` (mounted by `NotificationsHost`) asks `GET /recordings/notices?unread_only=true` on start and whenever the app comes to the front, at most once a minute, signed in only. Each `comment_reply` becomes an inbox item of kind `reply` (`lib/notifications/serverKinds.ts replyNotification`, `lib/comments/replyNotices.ts`), is handed to the notification centre (the same id twice changes nothing, a deleted one does not return) and is marked read on the server so it is not sent again. Notices of other kinds are left alone. The preview has fixtures instead (`lib/fixtures/notifications.ts`).
* **Kind `reply` in the registry.** Reminder tier, source server, account-bound (removed at sign-out), kept 30 days, stops counting as unread after a week like any reminder, Android channel `replies` ("Replies to you", group Messages, default importance), tile icon a speech bubble. Not an "important" notice: it is not about the person's own upload or a review result, so it has no 180-day unread keep and does not sit in "Needs your attention".
* **Grouping.** Replies fold by conversation, not by day: three or more replies to one comment in one section become one row "3 replies to your comment" (newest text on top, a tap opens the single rows); fewer stay single rows ("Name replied to your comment."). `AppNotification.group` carries the conversation id; `KindMeta.groupCount` picks the group words.
* **Tap.** Opens `/song-v2/ps-N?comment=<parent_id>` or `/recording/<id>?comment=<parent_id>`: the page scrolls to the comments and that comment's replies are open. A song that is not in the library opens the song list with the usual "gone" bar (`resolveTarget`).
* **Not done:** a native push for replies (needs the phase 2 server push, `docs/notifications.md` section 11) and a per-kind switch in settings. Until then the OS channel cannot be muted because no push uses it; the notice only fills the centre. A server cap on stored reply notices is not built: the anti-flood brake (5 posts a minute) bounds how fast they can come, and the endpoint returns the newest 50.

## Anti-flood

One rule, no allowance per hour or per day: **5 posts a minute per member (team 30)**, over a sliding 60 seconds, shared by song comments, recording comments and replies. Over the limit the answer is 429 and the phone says "You can post up to 5 comments a minute. Wait a moment and try again." The check runs after the text is validated and the answered comment is resolved, so a refused post costs nothing. Other limits that remain: 2000 characters, 2 links, no identical comment twice in one conversation target (409), 50 replies per conversation. The limiter is in memory per API process (see `song-comments.md`, QA-024).

## The author-delete marker (QA-059)

`removed_by` of an author-deleted comment is `"\x1fauthor"`, a control character in front. `team_removed_by()` strips control characters from the name of a team member, so no display name can ever equal the marker. Migration `0037_comment_replies` adds the reply columns and rewrites the old `author` marker on song comments; it is idempotent and has a downgrade.

## The team review desk

`app/team-review.tsx`, opened from the "Review desk" row of the Upload hub (shown to the team only; the server decides, a refusal shows "Only the team can open the review desk"). Three tabs, each with the open list and the removed list:

| Tab | Open list | Approve | Remove | Restore |
| --- | --- | --- | --- | --- |
| Chords (recording chord sheets) | waiting for a first look (`/recording-chords/review/queue?filter=pending`) | `POST /review/{id}/approve` | `POST /review/{id}/reject` (reason of 3+ characters, the author reads it) | `POST /review/{id}/restore` |
| Comments (song and recording, merged) | reported (`/review?filter=reported`) | `POST /{id}/keep` | `DELETE /{id}` with an optional reason | `POST /{id}/restore` |
| Videos | reported (`/video-links/review?filter=reported`) | `POST /{id}/keep` | `DELETE /{id}` with an optional reason | `POST /{id}/restore` |

"Approve" on a reported comment or link means "looked at, stays": the reports leave the queue. Tab badges show how many items wait. Each item shows where it hangs, the author (the team sees the author of an anonymous item too), the text, and an Open button to the song or recording. Video links are published at once, so the "waiting" list of that tab is the reported links. Preview: `/team-review?team`.
