import { chordSpec, type ChordSpec } from "./theory"

/**
 * The keys of a chord on a piano or a harmonium, for the chord card (docs/chord-card.md).
 *
 * One voicing, root position, stacked upwards from the root: the root is a key of the octave of middle C (MIDI 60..71),
 * the other tones are the next keys above it. A slash chord adds its bass note one octave below the root. The harmonium
 * has the same black and white layout as the piano, so both draw from this; the harmonium also says the swara of each key
 * (Sa Re Ga ...) for the Sa the player uses (C unless told otherwise).
 */

export const MIDDLE_C = 60

const mod12 = (n: number) => ((n % 12) + 12) % 12
const WHITE = new Set([0, 2, 4, 5, 7, 9, 11])
export const isWhite = (midi: number) => WHITE.has(mod12(midi))

export type LitKey = {
  midi: number
  /** the note written the way the chord spells it ("F#", "Bb") */
  name: string
  isRoot: boolean
  isBass: boolean
}

/** The lit keys of a chord, lowest first. `[]` for a chord that is not supported. */
export function chordKeys(text: string): LitKey[] {
  const spec = chordSpec(text)
  if (!spec) return []
  return keysOf(spec)
}

function keysOf(spec: ChordSpec): LitKey[] {
  const rootMidi = MIDDLE_C + spec.rootPitchClass
  const lit: LitKey[] = []
  let last = rootMidi - 1
  for (const tone of spec.tones) {
    // the next key above the previous one with this pitch class (the root itself is the first)
    let midi = rootMidi
    if (tone.semitones !== 0) {
      midi = last + 1
      while (mod12(midi) !== tone.pitchClass) midi += 1
    }
    lit.push({ midi, name: tone.name, isRoot: tone.semitones === 0, isBass: false })
    last = midi
  }
  if (spec.bass !== null) {
    const bassMidi = MIDDLE_C - 12 + spec.bass
    const inChord = lit.find((k) => mod12(k.midi) === spec.bass)
    if (inChord) {
      // the chord already has that note: the bass is that tone sounding an octave lower
      lit.unshift({ midi: inChord.midi - 12, name: inChord.name, isRoot: false, isBass: true })
    } else {
      lit.unshift({ midi: bassMidi, name: spec.bassName ?? "", isRoot: false, isBass: true })
    }
  }
  return lit.sort((a, b) => a.midi - b.midi)
}

/** The keys to draw: from a C at or below the lowest lit key to a white key above the highest, at least 10 white keys wide. */
export function keyWindow(lit: readonly LitKey[]): { start: number; end: number } {
  const lowest = Math.min(...lit.map((k) => k.midi), MIDDLE_C)
  const highest = Math.max(...lit.map((k) => k.midi), MIDDLE_C)
  const start = lowest - mod12(lowest)
  let end = Math.max(start + 16, highest) // C to the E an octave and a third up
  while (!isWhite(end)) end += 1
  return { start, end }
}

/** Number of white keys in a window. */
export function whiteKeyCount(window: { start: number; end: number }): number {
  let n = 0
  for (let midi = window.start; midi <= window.end; midi += 1) if (isWhite(midi)) n += 1
  return n
}

const SWARA = ["Sa", "re", "Re", "ga", "Ga", "Ma", "Ma#", "Pa", "dha", "Dha", "ni", "Ni"] as const

/** The swara of a key for a Sa given as a pitch class (0 = C): "Sa re Re ga Ga Ma Ma# Pa dha Dha ni Ni". */
export function swaraOfKey(midi: number, saPitchClass: number): string {
  return SWARA[mod12(midi - saPitchClass)]!
}

/** "Sa Ga Pa": the swaras of a chord's keys, lowest first. */
export function chordSwaraLine(text: string, saPitchClass = 0): string {
  return chordKeys(text)
    .filter((k) => !k.isBass)
    .map((k) => swaraOfKey(k.midi, saPitchClass))
    .join(" ")
}
