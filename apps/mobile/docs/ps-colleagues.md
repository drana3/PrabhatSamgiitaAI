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
- **Audio:** the 69 recordings by Gunavati play, from the catalogue's `media` rows: see `docs/ps-audio.md` (repository root).
  `lib/psColleagues/audio.ts` keeps the list of what the archives brought; it is a record, not what plays.
