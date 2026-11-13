# Chord card

One chord drawn for one instrument: guitar (fingering), piano (keys) or harmonium (keys with swaras). It is a shared
component, so any screen can show a chord the same way: the Kiirtan page uses it for the chord cycle, and the Bhajan
word-chords editor can call it for a bhajan's chords.

## Stable interface

```tsx
import { ChordCard } from "@/components/chords/ChordCard"

<ChordCard chord="F#m" instrument="guitar" />
<ChordCard chord="Bb" instrument="harmonium" sa={10} size="compact" />
```

| prop | type | meaning |
| --- | --- | --- |
| `chord` | `string` | any name the chord picker makes: `C`, `F#m`, `Bb`, `Dm7`, `Asus4`, `G/B` |
| `instrument` | `"guitar" \| "piano" \| "harmonium"` | what to draw |
| `size` | `"large" \| "compact"` | `large` (default) has labels; `compact` is for a strip of many chords |
| `sa` | `number` | harmonium only: the Sa as a pitch class (0 = C, the default, 10 = Bb) |
| `t` | `SpTheme` | optional; the song theme from `useSpTheme()` is used when it is left out |

The props `chord` and `instrument` do not change their names or meaning. New props may be added, never removed.

Also exported from `components/chords/ChordCard.tsx`:

- `ChordStrip({ chords, instrument, onOpen?, sa? })`: all the chords of a tune at once, each chord once, in the order
  given, in a row that scrolls sideways. `onOpen(chord)` fires on a tap.
- `InstrumentPicker({ value, onChange })`: the three buttons Guitar, Piano, Harmonium.

And `components/chords/ChordCardSheet.tsx`: `ChordCardSheet({ t, chord | null, chords?, instrument, onInstrument,
onChord?, onClose })`, the card in a bottom sheet with the picker over it and the strip under it.

The chosen instrument is kept by the screen that owns the card (a plain `useState`). `chordInstrumentOf(value,
fallback)` in `lib/chordCard/instrument.ts` turns a saved string into a valid instrument.

## What is supported

Exactly the ten qualities of the app's chord picker: major, m, 7, m7, maj7, sus2, sus4, dim, aug, add9 (also typed as
`maj`, `min`, `M7`, `sus`). A slash chord (`G/B`) keeps its bass note. Any other name (`C13`, `Cfoo`) is not drawn: the
card shows the name and one honest line (`chordCard.none`) instead of a wrong picture. To test a name before drawing:
`chordSpec(name)` returns `null` for an unsupported chord.

## Music theory (lib/chordCard)

- `theory.ts`: a chord is a root plus intervals, each as (letter steps, semitones), so notes are spelled the way a
  musician writes them: F# minor is F# A C#, Bb minor is Bb Db F. `chordPitchClasses`, `chordNoteLine` ("D – F – A – C").
- `guitar.ts`: standard tuning E A D G B E. Open shapes are written by hand; everything else is the E shape or the A
  shape slid to the root (the lower fret wins). `diagramOf` makes the picture data (first fret shown, dots, open and
  muted strings, barre).
- `keys.ts`: root position stacked up from middle C; a slash bass is added an octave below. `chordSwaraLine` gives the
  swaras for a Sa.

`__tests__/chordCard.test.ts` checks all 12 roots (17 spellings) times the 10 kinds: the pitch classes are the chord's
notes, every guitar fingering sounds exactly those notes when played back through the tuning (a triad is never missing a
tone, nothing foreign sounds), and the keys are the chord. A wrong fret or a wrong note cannot get in unnoticed. What
tests cannot say is whether a fingering is the one a teacher would show; a guitarist should look at the open shapes once.

## Where it is used

- Kiirtan page, tab Chords (`docs/kiirtan-page.md`): a tap on a chord of the ring opens the sheet; "All the chords of
  this tune" is the strip under the ring.
