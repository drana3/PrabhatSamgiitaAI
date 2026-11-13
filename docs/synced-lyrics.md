# Synced lyrics (plan only, no code)

Words that light up in time with the music. **Only for Prabhat Samgiita** (decision of 2026-11-08). Who sets the time marks is still open.

## 1. Model

A song has a list of lines; each line has a start time in milliseconds, and optionally the words inside it have start times.

```json
{
  "song": 1234,
  "version": "recording-uuid",
  "offsetMs": 0,
  "lines": [
    { "t": 12400, "text": "Bandhu hate ...", "words": [{ "t": 12400, "w": "Bandhu" }, { "t": 12900, "w": "hate" }] }
  ]
}
```

- Marks belong to a **recording** (a version), not to the song: a slower performance has other times. The song page picks the marks of the version that plays.
- `offsetMs` lets one correction move the whole set (a late start of the track).
- Word times are optional. A line-only file is valid and already useful; word times come later.

## 2. Format

Store as JSON (above) in the database. Import and export **LRC** for the lines (`[mm:ss.xx] text`), and enhanced LRC for the words (`<mm:ss.xx>word`), because there are many editors for it. The app code works with the JSON only.

## 3. Who sets the marks (open question)

1. The team, with a tap-along tool (below). Slow and reliable.
2. Authors for their own recordings, reviewed by the team ("Checked" is set only by the team, same rule as translations).
3. Automatic alignment of the text to the audio (forced alignment). Fast, but wrong on Sanskrit-like words, singing and a harmonium; the output must be checked by a person.

Suggestion: start with 1 on a few well-known songs, measure the time per song, then decide.

## 4. The tap-along tool

An admin-only screen: the recording plays, the lyrics show line by line. The person taps "next line" at the moment the line begins. Needs: play, pause, back 3 s, speed 0.75x, undo the last tap, a live preview ("play with marks"), save as a draft, submit for review. Each tap records the player position minus a small reaction delay (default 150 ms, adjustable). The same screen later takes word taps.

## 5. Display (pinned lyrics on the player)

- The lyrics panel already knows if marks exist (`lyricsAreSynced` in `lib/playerV2/lyricsSync.ts`, now a prototype flag). With marks: the current line is highlighted and scrolled to the middle; a tap on a line seeks to its time. Without marks: the panel looks as now.
- The position comes from the player progress, which arrives about once a second. Between events the screen extrapolates with the clock (same trick as the transition fader). The lead is 100 to 200 ms so the line appears before it is sung.
- Respect reduced motion: no smooth scroll, just a jump.

## 6. Server needs

- A table of marks: recording id, version, JSON, status (`draft`, `submitted`, `checked`), author, timestamps, and an index on recording id.
- Endpoints: read marks for a recording (public if `checked`), save a draft, submit, review (team only), import and export LRC.
- Rate limits and size limit (a song has under 200 lines; reject more than 2000).
- A migration. Run `ls apps/api/alembic/versions | tail -3` right before creating it.

## 7. Risks

- Different recordings of the same song: marks must never be reused across versions without a check.
- Devanagari and Roman script lines must have the same line count, or the marks cannot be shared between scripts. Marks are per line index.
- A song with repeats (a refrain sung again): the line list repeats the text, not the index.
