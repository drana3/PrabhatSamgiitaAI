/**
 * Chord to swara mapping for the harmonium (spec SCR-23 and the Harmonium part
 * of SCR-16).
 *
 * A chord is three keys pressed together: the root, the key 4 semitones above
 * it (3 for a minor chord) and the key 7 semitones above. Semitones are counted
 * on the keys, as printed. The swara of each key depends on where Sa is.
 *
 * The teaching copy and fingering are placeholders until a harmonium teacher
 * reviews them (open question 17). The mapping itself is arithmetic.
 */

export type ChordQuality = "major" | "minor" | "dominant7"
export type ChordRole = "root" | "third" | "fifth" | "seventh"

export type ParsedChord = {
  /** the name as written, normalised ("Am", "F#", "E7") */
  name: string
  /** 0 = C ... 11 = B */
  rootPitchClass: number
  quality: ChordQuality
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** Name of a pitch class, spelled with sharps like the keys on the harmonium. */
export function noteName(pitchClass: number): string {
  return NOTE_NAMES[((pitchClass % 12) + 12) % 12]!
}

/** Pitch class of a note name such as "D", "F#", "Bb". Returns null when it is not a note. */
export function pitchClassOf(name: string): number | null {
  const match = /^([A-Ga-g])([#b♯♭]?)$/.exec(name.trim())
  if (!match) return null
  const base = LETTER_PC[match[1]!.toUpperCase()]!
  const accidental = match[2]
  const shift = accidental === "#" || accidental === "♯" ? 1 : accidental === "b" || accidental === "♭" ? -1 : 0
  return (((base + shift) % 12) + 12) % 12
}

/** "Am", "F#m", "Bb", "E7", "Dmin". Returns null for anything else. */
export function parseChord(text: string): ParsedChord | null {
  const match = /^([A-Ga-g][#b♯♭]?)(m|min|minor|7)?$/.exec(text.trim())
  if (!match) return null
  const root = pitchClassOf(match[1]!)
  if (root === null) return null
  const suffix = match[2]
  const quality: ChordQuality =
    suffix === "7" ? "dominant7" : suffix ? "minor" : "major"
  return {
    name: `${noteName(root)}${quality === "minor" ? "m" : quality === "dominant7" ? "7" : ""}`,
    rootPitchClass: root,
    quality,
  }
}

/** Semitones above the root for each key of the chord. */
export const CHORD_INTERVALS: Record<ChordQuality, readonly number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dominant7: [0, 4, 7, 10],
}

const ROLES: Record<ChordQuality, readonly ChordRole[]> = {
  major: ["root", "third", "fifth"],
  minor: ["root", "third", "fifth"],
  dominant7: ["root", "third", "fifth", "seventh"],
}

export const QUALITY_LABEL: Record<ChordQuality, string> = {
  major: "major",
  minor: "minor",
  dominant7: "dominant seventh",
}

/** The formula line under the keys: "root, +4, +7" or "root, +3, +7". */
export function chordFormula(quality: ChordQuality): string {
  return CHORD_INTERVALS[quality]
    .map((interval) => (interval === 0 ? "root" : `+${interval}`))
    .join(", ")
}

// ---------------------------------------------------------------------------
// Swaras
// ---------------------------------------------------------------------------

export type Swara = {
  /** one-letter sargam token: uppercase = shuddha, lowercase = komal (S r R g G m M P d D n N) */
  token: string
  /** "Sa", "re" (komal), "Re" (shuddha), "Ma♯" (tivra) */
  latin: string
}

/** Twelve swaras, indexed by semitones above Sa. Matches the core harmonium keyboard. */
const SWARAS: readonly Swara[] = [
  { token: "S", latin: "Sa" },
  { token: "r", latin: "re" },
  { token: "R", latin: "Re" },
  { token: "g", latin: "ga" },
  { token: "G", latin: "Ga" },
  { token: "m", latin: "Ma" },
  { token: "M", latin: "Ma♯" },
  { token: "P", latin: "Pa" },
  { token: "d", latin: "dha" },
  { token: "D", latin: "Dha" },
  { token: "n", latin: "ni" },
  { token: "N", latin: "Ni" },
]

/** The seven shuddha swaras and their semitones above Sa. */
export const SHUDDHA_SWARAS: ReadonlyArray<{ name: string; semitones: number }> = [
  { name: "Sa", semitones: 0 },
  { name: "Re", semitones: 2 },
  { name: "Ga", semitones: 4 },
  { name: "Ma", semitones: 5 },
  { name: "Pa", semitones: 7 },
  { name: "Dha", semitones: 9 },
  { name: "Ni", semitones: 11 },
]

export function swaraAtSemitone(semitonesAboveSa: number): Swara {
  return SWARAS[((semitonesAboveSa % 12) + 12) % 12]!
}

/** Semitones above Sa of a pitch class, 0 to 11. */
export function semitonesFromSa(pitchClass: number, saPitchClass: number): number {
  return (((pitchClass - saPitchClass) % 12) + 12) % 12
}

/**
 * The seven swaras mapped to note names of a key: Sa = D gives
 * D E F# G A B C# (spec SCR-16, Harmonium).
 */
export function swaraNoteRow(saPitchClass: number): Array<{ name: string; note: string }> {
  return SHUDDHA_SWARAS.map(({ name, semitones }) => ({
    name,
    note: noteName(saPitchClass + semitones),
  }))
}

export type ChordKey = {
  role: ChordRole
  pitchClass: number
  note: string
  /** semitones above the chord root */
  fromRoot: number
  /** semitones above Sa, 0 to 11 */
  fromSa: number
  swara: Swara
}

export type ChordReadout = {
  chord: ParsedChord
  kindLabel: string
  keys: ChordKey[]
  formula: string
  /** "Dm: Re, Ma, Pa" style line for the readout */
  swaraLine: string
  /** "D F A" */
  noteLine: string
}

/** Everything the explainer shows for one chord in one key. */
export function chordReadout(chord: ParsedChord, saPitchClass: number): ChordReadout {
  const intervals = CHORD_INTERVALS[chord.quality]
  const roles = ROLES[chord.quality]
  const keys: ChordKey[] = intervals.map((interval, index) => {
    const pitchClass = (chord.rootPitchClass + interval) % 12
    const fromSa = semitonesFromSa(pitchClass, saPitchClass)
    return {
      role: roles[index]!,
      pitchClass,
      note: noteName(pitchClass),
      fromRoot: interval,
      fromSa,
      swara: swaraAtSemitone(fromSa),
    }
  })
  return {
    chord,
    kindLabel: QUALITY_LABEL[chord.quality],
    keys,
    formula: chordFormula(chord.quality),
    swaraLine: keys.map((key) => key.swara.latin).join(", "),
    noteLine: keys.map((key) => key.note).join(" "),
  }
}

// ---------------------------------------------------------------------------
// Keys on the 25-key harmonium layout (mandra Sa to taar Sa, index 0 to 24)
// ---------------------------------------------------------------------------

export const KEYBOARD_KEY_COUNT = 25
/** Index of the middle (madhya) Sa on the 25-key layout. */
export const MIDDLE_SA_INDEX = 12

/**
 * Where to press a chord: key indexes on the 25-key layout, root first.
 * Stays in the middle octave when the whole chord fits, otherwise drops one
 * octave so the top key never runs past taar Sa.
 */
export function chordKeyIndexes(chord: ParsedChord, saPitchClass: number): number[] {
  const rootOffset = semitonesFromSa(chord.rootPitchClass, saPitchClass)
  const intervals = CHORD_INTERVALS[chord.quality]
  const top = intervals[intervals.length - 1]!
  const preferred = MIDDLE_SA_INDEX + rootOffset
  const base = preferred + top <= KEYBOARD_KEY_COUNT - 1 ? preferred : rootOffset
  return intervals.map((interval) => base + interval)
}

/** A 13-key window (one octave plus the closing key) that holds all the given keys. */
export function windowAround(indexes: readonly number[], length = 13): { start: number; length: number } {
  const first = Math.min(...indexes)
  const last = Math.max(...indexes)
  const maxStart = KEYBOARD_KEY_COUNT - length
  let start = Math.max(0, Math.min(maxStart, first - 2))
  if (last >= start + length) start = Math.max(0, Math.min(maxStart, last - length + 1))
  return { start, length }
}
