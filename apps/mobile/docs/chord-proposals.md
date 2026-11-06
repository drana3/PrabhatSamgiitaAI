# Chord proposals and the Upload button

Members can offer chords, for guitar or for harmonium, for any of the 5,018 Prabhat Samgiita songs. An accepted chart shows on the song page, in the Chords section, drawn by the same code as the built-in chart. This note says what the format is, why it is built this way, how review works, and what has not been checked.

Code: API `apps/api/app/api/v1/song_chords.py` (service, model, migration `0031`, tests `tests/test_song_chords.py`); app `lib/songChords/`, `components/song-chords/`, `app/upload.tsx`, `app/upload-chords.tsx`, `app/chords-review.tsx`, words in `locales/chordProposals.ts`.

## Where things are

- **Upload button.** On every screen that carries the tab bar (Today, Songs, Kiirtan, Learn, and Search opened from a link), a solid orange button with a plus and the word "Upload" sits to the right of the tab pill. It opens the hub, `/upload`.
- **The hub** has two doors: "A recording" (the existing add-Kiirtan form, unchanged) and "Chords for a song" (new). Under them: "Your chord charts", each with its state (waiting, live, not published), the reason if the team declined it, a link to the song and a delete. A team member also sees "Review chord charts" with the number waiting.
- **The song page**, Chords section: under the built-in chart, "Chords from members" lists one chip for each chart (instrument and author), the chosen chart as letters over the lyrics, the capo or Sa control (starting where the author played), who made it, their note, "I played it" if they said so, Report (or Delete, for your own chart), and "Offer chords for this song". The built-in sample chart stays where it was.

## The format

A chart is what the song page already draws (`lib/songPage/chordChart.ts`):

```
song_id      1..5018
instrument   "guitar" | "harmonium"
base_key     the key the chart SOUNDS in (C, F#, Bb). For a harmonium chart: Sa.
capo         0..7, guitar only: the fret the author's capo was on
strum        optional, guitar only: "D D U U D U"
lines        one entry per lyric line (Roman text), in the song's order:
             [{ placements: [{ word: 3, chord: "Am" }, ...] }, ...]
played_it    true (required: the author says they played or checked it)
note         optional, 300 characters
is_anonymous display choice
```

A placement is "this chord starts on this word and stays until the next one". `word` is the index in `splitWords(line)` of the Roman lyric line (the same index the built-in chart and the pronunciation guide use), so a chart is tied to words and never to character positions. The lyric lines come from the same source as the song page (`buildLyricSources(...).roman`).

**Guitar: shapes and a capo.** A guitarist thinks in shapes (G, C, Em) and a capo fret. So the member picks the key of the SHAPES and the capo, and types shapes. The app stores the sounding chords: each shape moved up by the capo, and `base_key` = shape key moved up by the capo. The capo is kept as a hint. When a reader looks at the chart the song page shows `spShape(chord, capo)`, the shapes again, and the reader can move the capo. A chart written with capo 2 and shapes C Am F G is stored as D Bm G A in key D, and shows as C Am F G at capo 2.

**Harmonium: Sa.** The member picks the key of Sa and types chords in that key. A reader sets their own Sa and the chords move (`harmoniumChord`).

Chord names accepted: a letter A to G, `#` or `b`, then a suffix of letters, digits and `#()+-`, optionally `/bass`. The same rule is in the app (`lib/songChords/chordName.ts`) and on the server, which has the final say.

## How a member enters chords

Two ways, on one screen, both feeding the same data:

1. **Tap words.** Every line of the song is drawn as tappable words. Tap a word, a chord palette docks at the bottom: the chords already used in this chart, the usual chords in the key (I, IV, V, vi, ii, iii and the dominant seventh), "another chord" (root and kind) and a typed field. Previous and Next move through the words so a whole chart can be entered without leaving the palette. This is the way meant for a phone.
2. **Paste text.** For people who already have chords in a file: ChordPro-style, `[Am]word` in front of the word the chord starts on, one line of text for each song line. Optional header lines `{capo: 2}`, `{key: D}`, `{strum: D D U U}`. Nothing is guessed: if a line has the wrong number of words, a chord has no closing bracket or no word after it, a word differs from the song, or a name is not a chord, the box lists each problem with its line and column, in words, and "Use this text" stays closed until the errors are fixed. A line with a different number of words than the song line, and more lines than the song has, are errors. Having text for fewer lines than the song is only a warning and does not block.

Then a **preview** drawn by the song page's own pieces, "I played or checked these chords myself" (required), an optional note, "Share without my name", and Send.

The unfinished chart is kept on the phone (`stores/chordDraftStore.ts`), so closing the screen, a bad connection or an app restart does not lose a long entry. A restored draft says so and offers "Start over".

## Why this design

- **One renderer.** A proposal is stored in the model the song page already draws, so there is no second chord viewer to keep in step and no format conversion on the way to the page.
- **Words, not text.** Indexing by word survives a change of script (Devanagari, Bengali) and typing slips, and it is what the built-in chart does.
- **Sounding chords in the store, shapes on the screen.** Two players with different capos see the shapes that suit them from the same chart.
- **Several versions.** A member may keep up to 3 live charts for one song and instrument, and different members can each offer theirs. Nothing is overwritten. The song page lists them and the reader picks.
- **Honest labels.** Each chart says who made it (or "an anonymous member"), instrument, key and capo, and whether the author says they played it. The app does not check that it is musically right, and does not say it did.
- **Anonymity is for other members only.** The account stays attached so the team can deal with abuse and the author can delete their own chart. The public shape carries no name, id or avatar for an anonymous chart.

## Review

| Who sends | Result |
| --- | --- |
| Team member (`is_admin`, `is_super_admin` or one of the owner emails, the same rule as Kiirtan uploads) | published at once |
| Anyone else | `pending`: visible only to its author, with "Waiting for review" |

- The team sees the queue (Waiting, Reported, Live, Not published) in the app (`/chords-review`, signed-in team members) or with the admin key (`/api/v1/admin/song-chords`). Each card opens into the chart as the page will draw it, then Publish, Reject (a reason of at least three letters is required, and the author reads it in a notice and under "Your chord charts"), Publish again, Take down.
- A member can delete their own chart in any state.
- Anyone can report a published chart (wrong chords, offensive, spam, other): one report each. A report only raises the count and moves the chart into the "Reported" filter. It does not hide the chart by itself.
- Limits for non-team members: 10 charts per 24 hours, 6 per hour (the team: 120 per hour); at most 3 live charts per song and instrument; an identical chart (same key, capo and chords) is refused. The server answers with `X-Error-Code` (`chords_daily_limit`, `chords_duplicate`, `chords_open_limit`) and the app turns each into a sentence.

## Web preview

With `EXPO_PUBLIC_MOCKUP_DATA=1` the screens use an in-memory server (`lib/songChords/mock.ts`) that keeps charts until the page is reloaded, with two sample charts on PS 1. Add `?team` to the address to act as the team and try the review screen. The real server is never contacted in that mode.

## Not verified

- No run against a real PostgreSQL. The API tests run on SQLite, and the migration `0031` was written by hand and read, not applied to Postgres.
- Not tried on a phone or in a simulator: the touch feel of the tap editor and the docked palette, the keyboard over the paste box, and the tab bar with the extra button on real devices were seen only in the web preview at 390, 768 and 1440 px.
- The real song picker (`PsSongChooser`) was not driven in the preview; the screens were opened with `?song=1`.
- Team flows against the real API (the review endpoints for signed-in team members, notices to authors) are covered by API tests but were not tried end to end from the app.
- Russian and Spanish words have not been read by a native speaker (marked unreviewed in `locales/review.json`).
- The chart on the song page is drawn in Roman letters even when the page's main script is Devanagari or Bengali; the built-in chart follows the page script, the member charts do not yet.
- Chords on the page are not played back and not checked for being musically right.
