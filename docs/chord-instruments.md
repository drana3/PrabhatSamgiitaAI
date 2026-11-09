# Chord instruments: Harmonium, Piano, Guitar

Every kind of recording that takes chords (Kiirtan, Bhajan, Spiritual song) and every Prabhat Samgiita chart offers the same three instruments, in this order: **Harmonium, Piano, Guitar**. The chosen instrument is stored with the chords (`instrument` on a recording chord sheet and on a song chord proposal) and shown to everyone who opens them.

## What each instrument means

- Chords are stored as they **sound**. A guitar capo is only a hint for the player: the shapes shown are the sounding chord shifted down by the capo.
- **Guitar** is the only instrument with a capo and a strum pattern. The API refuses a capo or strum on any other instrument ("Only a guitar chart has a capo and a strum pattern").
- **Harmonium** and **Piano** write the chords as they sound and ask for the key (Sa for a harmonium). Piano shifts with the key like a harmonium (`harmoniumChord`) but without swara.
- Piano is new: Alembic migration `0063_chord_piano_instrument` widens the CHECK on `recording_chord_sheets.instrument` and `song_chord_proposals.instrument` to `('guitar','harmonium','piano')`. It is idempotent. Its downgrade refuses while piano rows exist.

## Which kinds take chords

- **Kiirtan**: the chord cycle (docs/kiirtan-cycle.md). Old plain-text sheets stay readable.
- **Bhajan** and **Spiritual song**: one editor (Spiritual song was set to the same editor as Bhajan, Dada's "Da"). First the words of the song are written, then a chord is put over every word: tap a word, pick the chord that starts on it, as on a Prabhat Samgiita page. This is a chord chart, not a cycle and not a loop.
- **Prabhat Samgiita**: the song page has its own charts; they use the same instrument choice.
- **Dance music** and **Baba's Audio Discourses** take **no** chords and no piano notes. The app hides the rows (`kindHasChords`, and the player More sheet drops the Chords row), and the API refuses them with 422 ("Dance music and Baba's Audio Discourses take no chords." / "...take no notes.").

## Bhajan flow, step by step

1. Words: paste or type the words of the song, then "Use these words".
2. Tap a word: the word is highlighted and the chord picker opens over it.
3. Chord picker: choose the chord that starts on this word (or clear it). Previous and next word buttons walk the line.
4. Review: the preview shows the chords above the words, and the chord pictures for the chosen instrument.
5. Submit: "Send" for a published recording; at upload time "Keep with this upload" keeps the chart in the queue and it is sent after the recording is published. A failed send leaves the chart and "Send the chords again".

At upload time the queue row shows a collapsed prompt that opens the same screen in draft mode (`/recording-chart?row=<row>&kind=bhajan`). The chart waits in `recordingChordsPendingStore.chartDrafts` (memory only), keyed by the queue row.

## Chord pictures

Guitar fingers, piano keys and harmonium keys are drawn by the shared `ChordCard` (`components/chords`, `lib/chordCard`), owned by the Kiirtan page work. This feature only stores the instrument and hands the card the chords through `SheetChordStrip` (`components/recording-extras/SheetChordStrip.tsx`): `cardChords(chart)` gives the shapes for a guitar (capo applied) and the sounding chords otherwise. The reader may look at another instrument in the card; that choice is not saved.

## Tempo

Not part of this feature.
