/**
 * Chord theory for the chord card (docs/chord-card.md): what notes a chord name is made of.
 *
 * Pure arithmetic, no React. A chord is a root plus a list of intervals; every interval is a pair
 * (letter steps above the root letter, semitones above the root), so a note is SPELLED the way a musician writes it:
 * F# minor is F# A C#, Bb minor is Bb Db F, never "A#m = A# C# F". The pitch classes are 0 = C ... 11 = B.
 *
 * Supported kinds are exactly the ones the app's chord picker offers (`QUALITIES` in lib/songChords/chordName.ts):
 * major, m, 7, m7, maj7, sus2, sus4, dim, aug, add9. A slash chord (G/B) keeps its bass note. Anything else is `null`
 * and the card says "no picture for this chord" instead of drawing a wrong one.
 */

export type ChordKind = "major" | "minor" | "dom7" | "min7" | "maj7" | "sus2" | "sus4" | "dim" | "aug" | "add9"

/** The suffix typed after the root for each kind. */
export const KIND_SUFFIX: Record<ChordKind, string> = {
  major: "",
  minor: "m",
  dom7: "7",
  min7: "m7",
  maj7: "maj7",
  sus2: "sus2",
  sus4: "sus4",
  dim: "dim",
  aug: "aug",
  add9: "add9",
}

/** Plain English name of each kind (the card shows it under the chord). */
export const KIND_NAME: Record<ChordKind, string> = {
  major: "major",
  minor: "minor",
  dom7: "dominant 7th",
  min7: "minor 7th",
  maj7: "major 7th",
  sus2: "suspended 2nd",
  sus4: "suspended 4th",
  dim: "diminished",
  aug: "augmented",
  add9: "major, added 9th",
}

/** [steps above the root letter (0 = the root itself), semitones above the root]. */
type Interval = readonly [number, number]

export const KIND_INTERVALS: Record<ChordKind, readonly Interval[]> = {
  major: [[0, 0], [2, 4], [4, 7]],
  minor: [[0, 0], [2, 3], [4, 7]],
  dom7: [[0, 0], [2, 4], [4, 7], [6, 10]],
  min7: [[0, 0], [2, 3], [4, 7], [6, 10]],
  maj7: [[0, 0], [2, 4], [4, 7], [6, 11]],
  sus2: [[0, 0], [1, 2], [4, 7]],
  sus4: [[0, 0], [3, 5], [4, 7]],
  dim: [[0, 0], [2, 3], [4, 6]],
  aug: [[0, 0], [2, 4], [4, 8]],
  add9: [[0, 0], [2, 4], [4, 7], [1, 14]],
}

/** The words for each tone of a chord, in the order of KIND_INTERVALS (root, third, fifth, ...). */
export type ToneRole = "root" | "third" | "fifth" | "seventh" | "second" | "fourth" | "ninth"
export const KIND_ROLES: Record<ChordKind, readonly ToneRole[]> = {
  major: ["root", "third", "fifth"],
  minor: ["root", "third", "fifth"],
  dom7: ["root", "third", "fifth", "seventh"],
  min7: ["root", "third", "fifth", "seventh"],
  maj7: ["root", "third", "fifth", "seventh"],
  sus2: ["root", "second", "fifth"],
  sus4: ["root", "fourth", "fifth"],
  dim: ["root", "third", "fifth"],
  aug: ["root", "third", "fifth"],
  add9: ["root", "third", "fifth", "ninth"],
}

const SUFFIX_KIND: Record<string, ChordKind> = {
  "": "major",
  maj: "major",
  M: "major",
  m: "minor",
  min: "minor",
  "7": "dom7",
  m7: "min7",
  min7: "min7",
  maj7: "maj7",
  M7: "maj7",
  sus2: "sus2",
  sus4: "sus4",
  sus: "sus4",
  dim: "dim",
  aug: "aug",
  add9: "add9",
}

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11] as const
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const

const mod12 = (n: number) => ((n % 12) + 12) % 12

export type ChordTone = {
  role: ToneRole
  /** 0 = C ... 11 = B */
  pitchClass: number
  /** spelled the way a musician writes it ("F#", "Bb") */
  name: string
  /** semitones above the root (14 for the added 9th) */
  semitones: number
}

export type ChordSpec = {
  /** the chord as it is written with a clean spelling ("F#m7", "Bb", "G/B") */
  name: string
  kind: ChordKind
  /** the root as written ("F#", "Bb") */
  root: string
  rootPitchClass: number
  tones: ChordTone[]
  /** the bass note of a slash chord (pitch class), or null */
  bass: number | null
  bassName: string | null
}

/** Pitch class and letter index of a note written as a letter and an optional # or b. */
function noteOf(letter: string, mark: string): { pc: number; letterIx: number } | null {
  const letterIx = LETTERS.indexOf(letter.toUpperCase() as (typeof LETTERS)[number])
  if (letterIx < 0) return null
  const shift = mark === "#" || mark === "♯" ? 1 : mark === "b" || mark === "♭" ? -1 : 0
  return { pc: mod12(LETTER_PC[letterIx]! + shift), letterIx }
}

/** Spells the note `semitones` above a root: the letter is fixed by the steps, the sign makes up the difference. Falls back to a plain name for a double sign. */
function spell(rootLetterIx: number, rootPc: number, steps: number, semitones: number, preferFlats: boolean): string {
  const letterIx = (rootLetterIx + steps) % 7
  const natural = LETTER_PC[letterIx]!
  const pc = mod12(rootPc + semitones)
  const diff = mod12(pc - natural + 6) - 6 // -6..5
  if (diff === 0) return LETTERS[letterIx]!
  if (diff === 1) return `${LETTERS[letterIx]}#`
  if (diff === -1) return `${LETTERS[letterIx]}b`
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[pc]!
}

/** Reads a chord name. `null` when it is not one of the supported kinds. */
export function chordSpec(text: string): ChordSpec | null {
  const match = /^([A-Ga-g])([#b♯♭]?)([A-Za-z0-9]*)(?:\/([A-Ga-g])([#b♯♭]?))?$/.exec(text.trim())
  if (!match) return null
  const [, letter, mark, suffix, bassLetter, bassMark] = match
  const root = noteOf(letter!, mark ?? "")
  const kind = SUFFIX_KIND[suffix ?? ""]
  if (!root || !kind) return null
  const flats = mark === "b" || mark === "♭"
  const rootName = `${letter!.toUpperCase()}${flats ? "b" : mark === "#" || mark === "♯" ? "#" : ""}`
  const roles = KIND_ROLES[kind]
  const tones: ChordTone[] = KIND_INTERVALS[kind].map(([steps, semitones], i) => ({
    role: roles[i]!,
    semitones,
    pitchClass: mod12(root.pc + semitones),
    name: i === 0 ? rootName : spell(root.letterIx, root.pc, steps, semitones, flats),
  }))
  let bass: number | null = null
  let bassName: string | null = null
  if (bassLetter) {
    const b = noteOf(bassLetter, bassMark ?? "")
    if (!b) return null
    bass = b.pc
    bassName = `${bassLetter.toUpperCase()}${bassMark === "#" || bassMark === "♯" ? "#" : bassMark === "b" || bassMark === "♭" ? "b" : ""}`
  }
  const name = `${rootName}${KIND_SUFFIX[kind]}${bassName ? `/${bassName}` : ""}`
  return { name, kind, root: rootName, rootPitchClass: root.pc, tones, bass, bassName }
}

/** The pitch classes of a chord (a slash chord's bass is added when it is not already a tone). `[]` for a name that is not supported. */
export function chordPitchClasses(text: string): number[] {
  const spec = chordSpec(text)
  if (!spec) return []
  const set = spec.tones.map((tone) => tone.pitchClass)
  if (spec.bass !== null && !set.includes(spec.bass)) set.push(spec.bass)
  return set
}

/** "C – E – G": the notes of the chord as a line (the added 9th and a slash bass included). */
export function chordNoteLine(text: string): string {
  const spec = chordSpec(text)
  if (!spec) return ""
  const names = spec.tones.map((tone) => tone.name)
  if (spec.bassName && !spec.tones.some((tone) => tone.pitchClass === spec.bass)) names.unshift(spec.bassName)
  return names.join(" – ")
}
