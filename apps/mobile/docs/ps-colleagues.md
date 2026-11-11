# The colleagues' archives in the app (11 November 2026)

Source: `data/curated/ps_colleagues/` (see its README). The phone does not read those files; it reads three small ones,
`apps/mobile/data/psColleagues/{translations,chords,audio}.json`, built by `node scripts/buildPsColleagueData.mjs`
(nothing is edited; romanisation lines, derived placements and duplicated line lists are left out; a page of words
without chord symbols is not shipped; a second "translation" that is a romanised lyric, song 3261 uk, is dropped).
Each file is loaded on first use with a dynamic `import()` (`lib/psColleagues/load.ts`), so a web export puts it in its
own chunk and a phone does not parse it until the Meaning or Chords tab asks. Sizes: translations 632 KB, chords 151 KB,
audio 10 KB.

## What the page shows

- **Meaning, Translation:** when the song has colleague texts, a row of chips: Official (as before, never replaced),
  English · colleagues, Русский, Українська, Français. A colleague text carries "From colleagues' collection" and the
  document's own source note under it. A second text of the same language is an "Other version".
- **Chords:** under the song's own card, "Colleagues' chords": the page of the Word document as a monospace text (symbols
  over the words, scrolls sideways) with its capo as the document writes it. When a chord-sheet PDF also exists for the
  song, its chord lines are a second card with the PDF's own capo; if capo or chords differ, one line says so and both
  are shown, never merged. A song with no chord symbols in the archives shows nothing new.
- **Audio:** not shown. `lib/psColleagues/audio.ts` only lists the recordings per song.

## What audio needs before it can play (not done, by decision: no database, API or server writes)

The 69 files are in the private R2 bucket `am-site-books-private`, keys `audio-extractor/ps-audio/<number> <English title>.<ext>`
(`audio.json`). To make them play:

1. a row per file in the catalogue's `media` table (`song_number`, `kind` audio, `provider`, `title`, `url`) so that
   `songDetailToMockSong` lists it (that is where `audioRecordings` comes from); the old links stay, the file with
   `is_current` goes first;
2. a way for the phone to get a playable link: the bucket is private, so either an API route that signs a short-lived GET
   for an `r2_key`, or a public domain in front of the bucket (a decision about access);
3. no migration is needed if `media` rows are used.
