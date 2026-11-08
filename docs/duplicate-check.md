# Duplicate check on upload (all kinds)

Every upload of every kind (Kiirtan, Bhajan, Prabhat Samgiita, Spiritual song, Dance music, Baba's Audio Discourse), single, queue
or playlist, goes through the same check. API: `apps/api/app/services/recording_matches.py` (the rules) and `library_matches()` in
`apps/api/app/services/recordings.py` (the search); tests `tests/test_recording_matches.py`. This file is the logic. The phone card
that shows the match is built (see "What the phone shows" below).

## Layers

| Layer | How it is decided | When it exists |
|---|---|---|
| title | case, accents, spaces and punctuation removed, then equal, or ratio of 0.88 or more with the same numbers, at least 6 characters ("Kiirtan 1" is not "Kiirtan 2") | always |
| duration | within 2 seconds or 1 percent, whichever is more | only when the server could read the length (needs `fpcalc`) |
| sound | Chromaprint fingerprint, similarity 0.80 or more | only when `fpcalc` is installed on the server |
| same file | SHA-256 | always; **not a layer but a hard stop** |

Without `fpcalc` there is no duration and no fingerprint: the check is then title plus the exact file only, and nothing says
otherwise. **Whether `fpcalc` is on the production server is not verified**; tests use a fake `fpcalc`. If it is missing, the
check is weaker, never wrongly strong.

## Who is offered what

* The exact file already in the library: hard stop, 409 `duplicate` (or `removed_duplicate` if the team took it down). The answer names the length.
* A match: **sound**, or **title and duration together**. One of title or duration alone offers nothing (many Kiirtans are called
  "Baba Nam Kevalam", many last five minutes). 409 `similar_recording` with up to three `similar` recordings; each has `reasons`
  (`title`, `duration`, `sound`) and `duration_sec`. The file stays on the server until the person answers.
* Answer "different": the same request with `confirm_different` (+ the key) publishes it and records the pair so it is not asked again;
  the team can see the pair. Answer "same": the stored file is deleted, nothing is published.
* Never offered: removed recordings, those under review, those of an author the uploader blocked, pairs already confirmed "different".
* In a queue or playlist the check runs per row or track; the others carry on.

## What the phone shows

The card "Is this the song you want to upload?" (`apps/mobile/components/kirtan/add/DuplicateCard.tsx`). It is the same for every kind
and every way of uploading: the single form, a queue row and a playlist track all use it through `QueueRow`.

* It lists up to three matches (title, author, length). Each has a small **Play** button; a second tap, or the same button now
  reading **Stop**, stops it.
* **Its own player.** The preview (`lib/kirtan/preview.ts`, logic in `lib/kirtan/previewCore.ts`, tested without a phone in
  `__tests__/kirtanPreview.test.ts`) is not the app's player: it does not touch the queue, the radio, the mini-player or the
  playing song's place in the list. It only asks other sound (a song, the radio) to pause while the clip plays. One clip at a time.
  Every start takes a ticket, so a file that finishes loading after the person answered or tapped another one is thrown away and
  never sounds. The sound stops when the card closes (answer, remove the row, leave the screen) and when the person answers.
* **An honest note.** When no listed match was found by sound (`reasons` has no `sound`: the server has no `fpcalc`, or the
  match is by title and length), the card says so: the check compares the sound only where the server can. It never claims more
  than the check did.
* **"Yes, this is it"**: the file is not uploaded and the server copy is deleted. The person is told "This recording is already
  here. Upload a different one." and goes back to choosing a file (the single form focuses the file field; a playlist goes back to
  its first step when no track is left).
* **"No, mine is different"**: the upload goes on and the pair is recorded as "confirmed different" for the team.
* In the demo preview (no server) there is no similar answer, only the exact-copy one, so the card is seen with a real API.
