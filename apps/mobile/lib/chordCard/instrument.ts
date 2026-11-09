/**
 * The three instruments a chord can be shown on (docs/chord-card.md). The chord card, the strip of cards and the
 * instrument picker all take this one value, so a screen that remembers the member's choice (the Bhajan word-chord
 * editor) only has to store one of these three words.
 */
export type ChordInstrument = "guitar" | "piano" | "harmonium"

export const CHORD_INSTRUMENTS: readonly ChordInstrument[] = ["guitar", "piano", "harmonium"]

export function isChordInstrument(value: unknown): value is ChordInstrument {
  return value === "guitar" || value === "piano" || value === "harmonium"
}

/** A stored or sent value turned into an instrument; anything unknown becomes the fallback (guitar). */
export function chordInstrumentOf(value: unknown, fallback: ChordInstrument = "guitar"): ChordInstrument {
  return isChordInstrument(value) ? value : fallback
}

/** The chords of a tune in the order they first appear in the ring, each once ("Em C G Em" gives Em C G). */
export function distinctChords(chords: ReadonlyArray<string | null | undefined>): string[] {
  const out: string[] = []
  for (const chord of chords) {
    if (chord && !out.includes(chord)) out.push(chord)
  }
  return out
}
