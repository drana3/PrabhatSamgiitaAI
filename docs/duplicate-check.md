# Duplicate check on upload (all kinds)

Every upload of every kind (Kiirtan, Bhajan, Prabhat Samgiita, Spiritual song, Dance music, Baba's Audio Discourse), single, queue
or playlist, goes through the same check. API: `apps/api/app/services/recording_matches.py` (the rules) and `library_matches()` in
`apps/api/app/services/recordings.py` (the search); tests `tests/test_recording_matches.py`. This file is the logic. The phone card
that shows the match is part of the upload steps (board `Для-Дады/мастер-загрузки-киртана`) and is not built yet; the existing
"similar" row of the queue and playlist keeps working in the meantime.

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

## What the phone shows (proposal, in the board)

"Is this the song you want to upload?" with a small player (stops on close, the normal player policy `docs/player-visibility.md`).
"Yes, this is it": "This recording is already here. Upload a different one." and back to choosing a file. "No, mine is different":
continues and the recording is flagged "confirmed different" for the team.
