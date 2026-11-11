# Piano sheets read from "50 PS with translation"

Sheet music of 50 Prabhat Samgiita songs, read from the PDF `50 ПС с переводом.pdf` (72 A4 pages, exported from
MuseScore) by `scripts/ps_piano_from_pdf.py`. One JSON file per song (`ps_0005.json` is PS 5), `index.json` with one line
per song, and `REPORT.md` with the totals and every doubt (both written by the script).

**Status: read by a program, not yet checked by the team.** The app says so on every one of these sheets.

## What was read

- 50 songs, 384 rows, 7719 steps (a step is one note or one rest).
- 106 doubts in 29 songs. They are listed song by song in `REPORT.md` and inside each song's `doubts` field.
- Sa is uncertain in 10 songs: PS 5, 127, 158, 419, 737, 960, 1550, 2036, 2777, 5009 (`sa.uncertain` is `true`).
- The app bundles a compact copy of the rows in `apps/mobile/data/psPianoFromPdf.json` (written by the same script with
  `--app-json`). A test keeps the two in step.

## How to run it

```bash
python3 -m venv .venv-ps && .venv-ps/bin/pip install pymupdf
.venv-ps/bin/python scripts/ps_piano_from_pdf.py --pdf "50 ПС с переводом.pdf"                  # dry run: prints a table
.venv-ps/bin/python scripts/ps_piano_from_pdf.py --pdf "50 ПС с переводом.pdf" --write \
  --app-json apps/mobile/data/psPianoFromPdf.json                                               # writes this folder and the app file
.venv-ps/bin/python scripts/ps_piano_from_pdf.py --pdf "50 ПС с переводом.pdf" --songs 5,29 --overlay /tmp/overlay   # PNGs with the read notes drawn over the pages
```

Nothing is written without `--write`. Nothing touches a database or a server.

## How the notes are read

The PDF keeps the staff as vector lines and every note, rest, clef and accidental as a glyph of the Leland music font
(SMuFL code points), so nothing is guessed from a picture.

- **Pitch**: the vertical position of the note head on its staff (treble clef, bottom line E4), the key signature, and
  the accidentals of the bar (they last until the barline). Result: semitones above Sa (`k`) and the swara name.
- **Length**: note head, dots, flags and beams, in quarter notes (`b`). Ties are merged, slurs only recorded. A bar
  whose lengths do not add up to the time signature goes to the doubts, except a pick-up bar that the last bar completes.
  A triplet is accepted when the bar adds up.
- **Sa**: votes. The key signature gives two candidates (major tonic and its relative minor), 1.5 each; the first chord,
  the last chord (the capo is added to the chord shape) and the last note give 1 each. A winner that is not one of the
  key signature's candidates, or a margin under 1, is a doubt ("check by ear"). The octave is the one that puts the lowest
  note within 6 semitones below to 5 above Sa.
- **Chords** are the symbols printed above the staff (Cyrillic look-alike letters are mapped to Latin).
- **Playing order**: rows follow the printed lines. A volta (1., 2.) is played once per volta after the bars it follows;
  printed repeat signs are followed. Where a volta has no printed repeat sign, the bars before it are played again
  (read from the brackets and the "(2x)" in the text); this is written in `structure` for the song. Lines such as
  "(повторить B, A, A)" are kept word for word in `repeatInstructions` and are **not** acted on.

## What was not read

- Grace notes (PS 10, 68, 80, 1025) are left out of the steps. Each is a doubt.
- Ornament signs (mordent, turn) are marked on the note (`ornament`) and not played. Each system with some has a doubt.
- The performance order written only as text (`repeatInstructions`) is not turned into rows.
- PS 763 has no title in the PDF (only "PS №763"). Its notes are marked by the PDF as "подобран по музыкальной записи"
  (picked from a recording).
- Syllables under the notes are matched to the nearest note; where two syllables fall under one note, or one is far from
  every note, there is a doubt. Syllables are in the detailed rows only (`rowsDetail`), not in the app.

## Compared with the booklet (songs 1, 2, 27)

The app already had the booklet's sargam for PS 1, 2 and 27. **The booklet stays for those three.** PS 27 is not in the PDF.

- **PS 1**: the booklet has 58 steps, the PDF 85; the melodies are alike but not the same (similarity of the note
  sequences 0.58). The booklet writes the refrain and verse as sargam text, the score has more detail and a
  different rhythm ("Pa Ma Ga" opens both).
- **PS 2**: booklet 77 steps, PDF 84; similarity 0.86. Example: the booklet has `Ni Sa` (11, 0) where the score has
  `Dha Ni Sa` below Sa (-3, -1, 0).
- **Unit of length**: the booklet counts in matras (eighth notes), the score in quarter notes (`b`). At the same
  speed (beats per minute) the same melody plays twice as fast from the collection as from the booklet. Not changed
  here; for the team to decide.
