# Kiirtan chord cycle

A Kiirtan has no lyric lines to hang chords on: a few chords go round and round. A cycle is the
way to write that down. It is the third kind of chord sheet a recording can have (the other two are
the plain text sheet and the word-by-word chart). It is for Kiirtan only; Bhajan and Spiritual song
recordings keep the chart (words first, then chords above the words) and PS keeps its own sheets.

## Model

One recording can play several **tunes** (melodies): a Kiirtan may change its tune during the
recording (a slow round, then a fast one). Each tune has its own ring of chords and its own key.
The member says how many tunes there are (1 to 30) and which of them have chords; a tune without
chords stays in the recording as "no chords yet" and another member can add it later.

| Field | Rule |
| --- | --- |
| tune_count | 1 to 30: how many tunes are played in the recording |
| tunes | the tunes that have chords, each with a `number` from 1 to `tune_count`; a number that is missing means "no chords yet" |
| chords per tune | 2 to 8, four by default in the app |
| start | required: which chord of the ring the tune starts on |
| times | optional "x N" (how many rounds), 1 to 99 |
| name | optional, one short line (30 characters), no web links |
| key | optional, per tune; "Not sure" is the default |

The cycle is stored in `recording_chord_sheets.cycle` (JSON, null for other kinds; migration
`0049_kiirtan_cycle_video_status`) as `{"tune_count": N, "tunes": [{number, name, key, chords,
start, times}]}`. `body` is filled with the same cycle written as text, so a reader that does not
know cycles still shows something. The sheet's `chart_key` is the key of the first tune that has
one. Two tunes may share the same chords.

**Size.** 30 tunes of 8 chords come to a few kilobytes of JSON, far under the API request limit
(1 MB). The text written into `body` is limited to 12000 characters (30 tunes with the longest
names, keys, chords and rounds come to about 7000).

**Backward compatibility, no migration.** Cycles saved before tunes existed hold
`{"forms": [...]}`. `normalize` in `kiirtan_cycles.py` reads each old form as a tune with the same
number, and the request schema still accepts `forms` (a before-validator turns it into `tunes`).
Nothing in the database was rewritten.

## Moderation (nothing new)

A cycle is a chord sheet, so everything around chord sheets applies unchanged:

- a member's cycle goes to the team review queue; a team member's goes live at once;
- sending a new one replaces the version (the old one is kept as history);
- the author can withdraw it; anyone can report it;
- the same daily allowance: 10 chord proposals in 24 hours per member;
- "Start from this chart" (`based_on`) works. Adding a missing tune uses it: "Add chords for tune
  N" opens the entry screen on that tune with the other tunes copied from the live cycle; the result
  is a new sheet of the member, credited to the first author, and goes to the review queue.

Endpoints are the existing `/api/v1/recording-chords` ones (`GET/POST /recordings/{id}`, `PUT/DELETE
/{sheet_id}`, `POST /{sheet_id}/report`, `/review/...`); a cycle is sent in the `cycle` field.
Cleaning and the text written from it live in `apps/api/app/services/kiirtan_cycles.py`.

## Entry screen

`apps/mobile/app/recording-cycle.tsx` (modal), a short wizard:

1. **How many tunes are played in the recording?** (1 to 30) A stepper (− 1 +) with a typed number in the middle.
2. If more than one: **do you have chords for all the tunes, or only for some?** ("All of them" or
   "Only some"). For "Only some" there is a grid of numbers 1 to N to tick, the buttons "All" and
   "None", a line "Chosen: 3 of 30", and, when there are more than six tunes, a field for a range
   such as "1-5, 8" (`parseTuneRange`).
3. One step for each chosen tune: "Tune 2 of 3", the ring (4 chords by default, add or remove up to
   8), the start chord (required), the optional "x N", the key of this tune ("Not sure" by default,
   a button "Same as previous tune", the line "Different tunes can be in different keys"). The
   member can skip a tune, go back, or fix an earlier one. A skipped tune stays "no chords yet".
   With more than one tune, a row of numbered chips over the ring jumps to any tune (a mark shows
   which are ready, which have no chords yet; a tune left as "no chords yet" is taken back into the
   walk when it is opened), with a line "12 ready, 3 without chords, 15 still to do".
4. **Check and send**: every tune as a card with "Change" (or "Add chords" for a tune with none;
   past six tunes the cards are compact one-line rows),
   the "I played or checked these chords myself" box, the note, and "Send for review".

Editing, copying and "start from this cycle" open on step 4 (with `tune=N`, on that tune's step).
The chord sheet of the app is used to pick a chord; its header says which tune and place of the
ring is being filled. The plain text route stays available through a link, and is still the way for
old text sheets and PS recordings.

## Display

`apps/mobile/components/recording-extras/CycleBlock.tsx` shows, on the recording page: the
instrument and version, a switcher "Tune 1 / Tune 2 / Tune 3" (one tab for every tune of the recording; the row scrolls sideways and, past six tunes, the tabs show just the number, with a dashed one for a tune without chords and a line "Tune 7 of 30"), the ring (`CycleRing.tsx`, read-only) and a line
that reads the tune in order starting from the start chord, plus the key, starts-on and rounds facts. A tune without chords shows "No chords yet for this tune." and
the button "Add chords for tune N".

**The current part is never highlighted.** The cycle is not synced with the audio, and the screen
says so. The text sheet stays beside it.

## Not checked

That the chords are musically right, and the timing. Both are said on the screen.

## Tests

API: `apps/api/tests/test_kiirtan_cycle.py`, `test_kiirtan_cycle_migration.py`.
Mobile: `apps/mobile/__tests__/recordingCycle.test.ts`.
