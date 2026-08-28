# Prompt: Admin line-by-line sargam capture

Copy this whole file into a new Agent chat (or `@.cursor/prompts/admin-line-sargam-capture.md`) when ready to implement. Do not commit/push unless the user asks.

**Published booklet sargam today (do not overwrite):** songs **1**, **2**, and **27** in `packages/core/src/harmonium-sample-songs.ts`. OCR drafts are not shown. This capture tool is how more songs get line-accurate sargam.

## Goal

Admins capture **canonical sargam per lyric line** for a given Prabhat Samgiita song, then submit the whole song. Learners see that sargam **under each lyric line**, plus **which admin submitted it**.

This is **not** automatic transcription from YouTube or from a microphone. Sargam is captured from the **virtual harmonium** (key presses / typed sargam), with record → replay → confirm or retake on every line.

## Product workflow

### Per line (required)

For each lyric line of the chosen song, in order:

1. **Play this line** — play the current take (or empty draft) on the virtual harmonium so the admin hears that line only. If the song has a catalog recording, a “play audio” control may exist for context, but it does not replace sargam capture.
2. **Record** — admin plays the line on the virtual harmonium (hold-to-sustain, same player as `apps/web/components/virtual-harmonium.tsx`). Store timed swaras (`western`, sargam token, `startSec`, `durationSec`) relative to Sa.
3. **Replay** — play the recorded take back on the keys (same engine as `playSheetEvents`). Highlight the line and keys.
4. **Confirm or retake**
   - **Confirm** — save that take as the line’s notation. Mark the line done. Move to the next undone line.
   - **Retake** — discard the last take and record again. Previous confirmed lines stay.

Do not auto-advance on record. Confirm is explicit.

### After every line is confirmed

1. **Final play** — play all confirmed lines in order, with a singer-length rest after each line (reuse `sampleSongLineEvents` timing / tempo tuner: slow · medium · fast).
2. **Final submission** — admin submits the whole song. Until submit, data is a **draft** (only that admin, or admins, can see/edit). After submit, the sargam is **published** on the song.

Submission is blocked if any lyric line has no confirmed take.

### After submit (learner-facing)

On the song page (web + mobile), each lyric line shows:

- lyric
- sargam for that line
- attribution: **Sargam submitted by {admin display_name}** (and submitted-at date)

If there is no submitted notation, do not invent sargam. Existing OCR `practice_draft` rows stay drafts until an admin submit replaces/publishes them.

## Who can do this

- Only signed-in members with `is_admin` (same gate as `apps/web/app/admin/*` and `apps/web/lib/admin-gate.ts`).
- Super-admin can also submit. Store `submitted_by` user id, not a free-text name.
- Display `UserAccount.display_name` (fallback email local-part). Never show raw user UUID in the UI.

## Data model (API + DB)

Extend notation so a **published** song has line-aligned sargam and attribution. Prefer additive schema, not a rewrite of PDF source URLs.

Suggested shape (adapt to existing `notations` / `HarmoniumNotation` in `apps/api/app/schemas/notation.py` and `apps/api/app/models/notation.py`):

- `song_number`
- `source_scale` (Sa tonic used when capturing)
- `verification_status`: `admin_draft` | `admin_submitted` (published)
- `notation_text`: JSON `HarmoniumNotation` with one `lines[]` entry per lyric line (`line_number`, `lyrics`, `measures` / sargam cells)
- metadata:
  - `submitted_by` (user id)
  - `submitted_by_display_name` snapshot at submit time (so later name edits do not rewrite history unless you choose to live-join)
  - `submitted_at`
  - `line_takes`: optional audit of last confirmed take per line (not required on learner API)

Drafts: either a new table `notation_captures` (song_number, admin_id, line_number, events JSON, status) **or** `metadata_json.draft` on the notation row. Drafts must not be returned by the public song notation endpoint.

Alembic migration in `apps/api/alembic/versions/`. Tests in `apps/api/tests/`.

## API (sketch)

Admin (member-admin proxy, same pattern as `apps/web/app/api/admin/*` → `forwardMemberAdmin`):

- `GET /admin/songs/{number}/sargam-capture` — lyrics lines + draft takes + submit eligibility
- `POST /admin/songs/{number}/sargam-capture/lines/{lineNumber}/takes` — save recorded events (record)
- `POST .../confirm` — lock line
- `POST .../retake` — clear current take, keep line open
- `POST /admin/songs/{number}/sargam-capture/submit` — require all lines confirmed; set published notation + attribution

Public:

- Existing `GET /songs/{number}/notation` returns submitted notation when `admin_submitted`
- Song payload (or notation payload) includes `sargam_attribution: { display_name, submitted_at }` for UI

## UI

### Admin (web first)

New page: `apps/web/app/admin/sargam/[number]/page.tsx` (link from `apps/web/app/admin/` nav).

- Song title + number, Sa selector, tempo tuner (slow / medium / fast)
- List of lyric lines with status: empty · recorded · confirmed
- Active line: Play line · Record · Stop · Replay · Confirm · Retake
- Sticky **Final play** + **Submit song** (disabled until all lines confirmed)
- Reuse `VirtualHarmonium` / `playSheetEvents` / `startWesternNote` from `apps/web/lib/harmonium-playback.ts` and `@prabhat/core` (`parseSargamInput`, `sargamPlayEvents`)

Do not put this behind the learner harmonium-practice profile opt-in. Admin capture is an admin tool.

### Learner

- Web song page + mobile `NotationPractice` / lyrics: show submitted sargam under each line and “Submitted by …”
- If only PDF/`practice_draft` exists, keep current “practice draft / see PDF” behaviour; do not show fake attribution

## Out of scope

- Pitch-detection / ML from mic or YouTube → sargam
- Replacing official PDF archives
- Non-admin members submitting
- Auto-commit or deploy

## Implementation constraints

- Touch only trees you need: `apps/api`, `apps/web`, `packages/core`; mobile only for learner display of submitted sargam
- Minimal diffs; follow existing admin auth, JSON notation schema, and tests
- Unit tests: confirm/retake/submit rules; attribution on published payload; UI smoke for admin page
- Local verify in the browser on `/admin/sargam/{number}` (e.g. song 1) before declaring done
- Do not commit unless the user asks

## Acceptance

- Admin can walk song 1 line by line: record, replay, retake, confirm
- After all lines, final play then submit
- After submit, song 1 lyrics show sargam per line and the admin’s display name
- Non-admin cannot open capture or call capture APIs
- Unsubmitted drafts never appear as published sargam
