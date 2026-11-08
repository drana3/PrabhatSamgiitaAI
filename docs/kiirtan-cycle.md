# Kiirtan chord cycle

A Kiirtan has no lyric lines to hang chords on: a few chords go round and round. A cycle is the
way to write that down. It is the third kind of chord sheet a recording can have (the other two are
the plain text sheet and the word-by-word chart). It is for Kiirtan only; Bhajan and Spiritual song
recordings keep the chart (words first, then chords above the words) and PS keeps its own sheets.

## Model

One recording can have a list of **forms**: one entry for each way the Kiirtan is played in the
recording (a slow round, then a fast one). Each form is a ring of chords.

| Field | Rule |
| --- | --- |
| forms | 1 to 8 per cycle |
| chords per form | 2 to 8, four by default in the app |
| start | required: which chord of the ring the form starts on |
| times | optional "x N" (how many rounds), 1 to 99 |
| name | optional, one short line (30 characters), no web links |

The cycle is stored in `recording_chord_sheets.cycle` (JSON, null for other kinds; migration
`0049_kiirtan_cycle_video_status`). `body` is filled with the same cycle written as text, so a
reader that does not know cycles still shows something. Key and capo are optional for a cycle
("Not sure" is the default, capo 0).

## Moderation (nothing new)

A cycle is a chord sheet, so everything around chord sheets applies unchanged:

- a member's cycle goes to the team review queue; a team member's goes live at once;
- sending a new one replaces the version (the old one is kept as history);
- the author can withdraw it; anyone can report it;
- the same daily allowance: 10 chord proposals in 24 hours per member;
- "Start from this chart" (`based_on`) works.

Endpoints are the existing `/api/v1/recording-chords` ones (`GET/POST /recordings/{id}`, `PUT/DELETE
/{sheet_id}`, `POST /{sheet_id}/report`, `/review/...`); a cycle is sent in the `cycle` field.
Cleaning and the text written from it live in `apps/api/app/services/kiirtan_cycles.py`.

## Entry screen

`apps/mobile/app/recording-cycle.tsx` (modal). Opening it asks "How many forms of Kiirtan are
played in the recording?" and then, for each form, the ring (4 chords by default, add or remove up
to 8), the start chord (required) and the optional "x N". The chord sheet of the app is used to
pick a chord; its header says which place of the ring is being filled. The plain text route stays
available through a link ("Write the chords as plain text instead"), and is still the way for old
text sheets and PS recordings.

## Display

`apps/mobile/components/recording-extras/CycleBlock.tsx` shows, on the recording page: the
instrument and version, a switcher between forms, the ring (`CycleRing.tsx`, read-only) and a line
that reads the form in order starting from the start chord, plus the starts-on and rounds facts.

**The current part is never highlighted.** The cycle is not synced with the audio, and the screen
says so. The text sheet stays beside it.

## Not checked

That the chords are musically right, and the timing. Both are said on the screen.

## Tests

API: `apps/api/tests/test_kiirtan_cycle.py`, `test_kiirtan_cycle_migration.py`.
Mobile: `apps/mobile/__tests__/recordingCycle.test.ts`.
