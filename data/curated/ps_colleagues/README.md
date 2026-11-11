# ps_colleagues: texts and recordings from the colleagues' archives (2026-11-11)

Built by `scripts/import_colleague_texts.py` and `scripts/import_colleague_audio.py` (both dry-run by default,
safe to run again). Nothing here is written to a database yet.

- `chords.json`: per song `charts[]`: `capo` (null when the document does not say), `lines` (the chart as a
  monospace page, chord lines kept character for character), `placements` (derived: line, column, chord, the
  lyric word under that column; about half of the chords fall between words because the document aligns them
  by eye in a proportional font). 146 songs have a chart page, 73 of them hold chord symbols.
- `chords_from_pdf.json`: capo and chord lines of the two chord-sheet PDFs (14 songs), kept apart because capo
  and chords differ from the documents for most of them.
- `translations.json`: per song `translations.{en,ru,uk,fr}` (`text`, `lines`, `date_line`, `title_line`,
  `source_note`, `romanisation_lines`) and `extra_versions` (a second text of the same language in the document).
  The language is detected from the words, not from the label in the document (labels are sometimes wrong).
- `audio.json`: per song the renamed recordings (`file_name`, `r2_key`, `status` planned or uploaded, `is_current`).
- `diff_english.json` and `backup/prior_english_meaning.json`: English text of the app before (`songs.json`
  `english_meaning`, untouched) against the document's, song by song.
- `report.json`: counts, songs not in the app, flagged songs.

There is no word-by-word translation in the documents; none was generated.
