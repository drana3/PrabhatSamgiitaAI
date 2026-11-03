/**
 * Chord logic for the song page (spec SCR-26).
 *
 * Rules:
 * - shape root = sounding root minus capo (a capo on fret N raises every shape by N);
 * - "Best capo" picks the capo position (0 to 7) with the fewest barre shapes;
 * - the harmonium key control maps Sa Re Ga Ma Pa Dha Ni to the note names of the chosen key.
 */

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const

export const MAX_CAPO = 7

export type ParsedChord = {
  /** pitch class 0..11 of the root */
  root: number
  rootLetter: string
  /** "m", "7", "maj7", "sus4" ... */
  suffix: string
  /** pitch class of the bass note of a slash chord, or null */
  bass: number | null
  /** the chord was spelled with a flat */
  flat: boolean
}

function mod12(n: number): number {
  return ((n % 12) + 12) % 12
}

function accidentalOffset(mark: string): number {
  if (mark === "#" || mark === "♯") return 1
  if (mark === "b" || mark === "♭") return -1
  return 0
}

export function parseChord(name: string): ParsedChord | null {
  const text = name.trim()
  const match = /^([A-G])([#b♯♭]?)([^/]*)(?:\/([A-G])([#b♯♭]?))?$/.exec(text)
  if (!match) return null
  const [, letter, mark, suffix, bassLetter, bassMark] = match
  const root = mod12(LETTER_PC[letter] + accidentalOffset(mark))
  const bass = bassLetter ? mod12(LETTER_PC[bassLetter] + accidentalOffset(bassMark ?? "")) : null
  return { root, rootLetter: letter, suffix, bass, flat: accidentalOffset(mark) < 0 }
}

export type Spelling = "sharp" | "flat"

export function noteName(pitchClass: number, spelling: Spelling = "sharp"): string {
  const table = spelling === "flat" ? FLAT_NAMES : SHARP_NAMES
  return table[mod12(pitchClass)]
}

/** Move a chord up (positive) or down (negative) by semitones. Unreadable names come back unchanged. */
export function transposeChord(name: string, semitones: number, spelling?: Spelling): string {
  const parsed = parseChord(name)
  if (!parsed) return name
  const how: Spelling = spelling ?? (parsed.flat ? "flat" : "sharp")
  const root = noteName(parsed.root + semitones, how)
  const bass = parsed.bass == null ? "" : `/${noteName(parsed.bass + semitones, how)}`
  return `${root}${parsed.suffix}${bass}`
}

export function clampCapo(capo: number): number {
  if (!Number.isFinite(capo)) return 0
  return Math.min(MAX_CAPO, Math.max(0, Math.round(capo)))
}

/** What the fingers play for a sounding chord with the capo on fret `capo`. */
export function shapeChord(sounding: string, capo: number): string {
  return transposeChord(sounding, -clampCapo(capo))
}

/** The real sounding chord for a shape played with the capo on fret `capo`. */
export function soundingChord(shape: string, capo: number): string {
  return transposeChord(shape, clampCapo(capo))
}

/**
 * Open shapes (low E to high e). `x` is a muted string. Frets are single digits.
 * Keys are the chord as printed with sharps, so a flat spelling finds the same row.
 */
export const OPEN_FINGERINGS: Record<string, string> = {
  C: "x32010",
  Cmaj7: "x32000",
  C7: "x32310",
  Cadd9: "x32030",
  D: "xx0232",
  Dm: "xx0231",
  D7: "xx0212",
  Dmaj7: "xx0222",
  Dm7: "xx0211",
  Dsus2: "xx0230",
  Dsus4: "xx0233",
  E: "022100",
  Em: "022000",
  E7: "020100",
  Em7: "022030",
  Emaj7: "021100",
  Esus4: "022200",
  G: "320003",
  G7: "320001",
  Gmaj7: "320002",
  A: "x02220",
  Am: "x02210",
  A7: "x02020",
  Am7: "x02010",
  Amaj7: "x02120",
  Asus2: "x02200",
  Asus4: "x02230",
  B7: "x21202",
}

/** Common movable shapes. Counted as barre chords. */
export const BARRE_FINGERINGS: Record<string, string> = {
  F: "133211",
  Fm: "133111",
  "F#": "244322",
  "F#m": "244222",
  Gm: "355333",
  "G#": "466544",
  "G#m": "466444",
  "A#": "x13331",
  "A#m": "x13321",
  B: "x24442",
  Bm: "x24432",
  Cm: "x35543",
  "C#": "x46664",
  "C#m": "x46654",
  "D#": "x68886",
}

function canonicalKey(name: string): string | null {
  const parsed = parseChord(name)
  if (!parsed || parsed.bass != null) return null
  return `${noteName(parsed.root, "sharp")}${parsed.suffix}`
}

export function fingeringFor(name: string): string | null {
  const key = canonicalKey(name)
  if (!key) return null
  return OPEN_FINGERINGS[key] ?? BARRE_FINGERINGS[key] ?? null
}

/** An open shape needs no barre. Unknown chords are counted as barre so "Best capo" stays conservative. */
export function isOpenShape(name: string): boolean {
  const key = canonicalKey(name)
  return key != null && key in OPEN_FINGERINGS
}

function uniqueInOrder(items: string[]): string[] {
  return items.filter((item, index) => items.indexOf(item) === index)
}

export function barreCount(shapes: string[]): number {
  return uniqueInOrder(shapes).filter((shape) => !isOpenShape(shape)).length
}

/** The capo position (0 to 7) with the fewest barre shapes. Ties go to the lower fret. */
export function bestCapo(soundingChords: string[]): number {
  const chords = uniqueInOrder(soundingChords.filter((chord) => parseChord(chord)))
  if (!chords.length) return 0
  let best = 0
  let bestScore = Number.POSITIVE_INFINITY
  for (let capo = 0; capo <= MAX_CAPO; capo += 1) {
    const score = barreCount(chords.map((chord) => shapeChord(chord, capo)))
    if (score < bestScore) {
      best = capo
      bestScore = score
    }
  }
  return best
}

export function capoLabel(capo: number): string {
  const value = clampCapo(capo)
  return value === 0 ? "Off" : `Capo ${value}`
}

export function capoNote(capo: number): string {
  const value = clampCapo(capo)
  return value === 0 ? "" : `Capo on fret ${value}`
}

/* ---------- fretboard diagram model ---------- */

export type DiagramModel = {
  /** first fret shown (1 when the nut is drawn) */
  baseFret: number
  /** 0 = low E ... 5 = high e; fret is relative to baseFret, 1..5 */
  dots: Array<{ string: number; fret: number }>
  open: number[]
  muted: number[]
  barre: { fret: number; from: number; to: number } | null
}

export function diagramModel(fingering: string): DiagramModel | null {
  if (!/^[x0-9]{6}$/i.test(fingering)) return null
  const frets = fingering
    .toLowerCase()
    .split("")
    .map((c) => (c === "x" ? -1 : Number(c)))
  const fretted = frets.filter((f) => f > 0)
  const maxFret = fretted.length ? Math.max(...fretted) : 0
  const minFret = fretted.length ? Math.min(...fretted) : 0
  const baseFret = maxFret > 4 ? minFret : 1

  let barre: DiagramModel["barre"] = null
  if (minFret > 0) {
    const atMin = frets.map((f, i) => (f === minFret ? i : -1)).filter((i) => i >= 0)
    const first = frets.findIndex((f) => f >= 0)
    const last = frets.length - 1 - [...frets].reverse().findIndex((f) => f >= 0)
    const allAtLeast = frets.slice(first, last + 1).every((f) => f >= minFret)
    if (atMin.length >= 2 && atMin[0] === first && atMin[atMin.length - 1] === last && allAtLeast) {
      barre = { fret: minFret - baseFret + 1, from: first, to: last }
    }
  }

  const dots = frets
    .map((f, string) => ({ string, fret: f - baseFret + 1, raw: f }))
    .filter((d) => d.raw > 0)
    .map(({ string, fret }) => ({ string, fret }))
  return {
    baseFret,
    dots,
    open: frets.map((f, i) => (f === 0 ? i : -1)).filter((i) => i >= 0),
    muted: frets.map((f, i) => (f === -1 ? i : -1)).filter((i) => i >= 0),
    barre,
  }
}

/* ---------- harmonium ---------- */

export const HARMONIUM_KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G"] as const
export const SWARAS = ["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni"] as const
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]

export function stepHarmoniumKey(key: string, direction: 1 | -1): string {
  const index = HARMONIUM_KEYS.indexOf(key as (typeof HARMONIUM_KEYS)[number])
  const from = index < 0 ? HARMONIUM_KEYS.indexOf("D") : index
  const next = Math.min(HARMONIUM_KEYS.length - 1, Math.max(0, from + direction))
  return HARMONIUM_KEYS[next]
}

function spellMajorScale(rootName: string): string[] {
  const parsed = parseChord(rootName)
  if (!parsed) return []
  const startLetter = LETTERS.indexOf(parsed.rootLetter as (typeof LETTERS)[number])
  const names: string[] = []
  let plain = true
  MAJOR_STEPS.forEach((step, degree) => {
    const letter = LETTERS[(startLetter + degree) % 7]
    const target = mod12(parsed.root + step)
    let diff = target - LETTER_PC[letter]
    if (diff > 6) diff -= 12
    if (diff < -6) diff += 12
    if (Math.abs(diff) > 1) plain = false
    names.push(`${letter}${diff === 1 ? "#" : diff === -1 ? "b" : ""}`)
  })
  const odd = names.some((n) => ["E#", "B#", "Cb", "Fb"].includes(n))
  if (!plain || odd) {
    const spelling: Spelling = parsed.flat ? "flat" : "sharp"
    return MAJOR_STEPS.map((step) => noteName(parsed.root + step, spelling))
  }
  return names
}

/** Sa = D gives D E F# G A B C#. */
export function swaraNotes(sa: string): Array<{ swara: string; note: string }> {
  const scale = spellMajorScale(sa)
  return SWARAS.map((swara, i) => ({ swara, note: scale[i] ?? "" }))
}

/** Semitones to move the chart's chords when the harmonium Sa is `key` and the chart was written for `baseKey`. */
export function harmoniumShift(baseKey: string | undefined, key: string): number {
  const from = parseChord(baseKey ?? key)
  const to = parseChord(key)
  if (!from || !to) return 0
  return mod12(to.root - from.root)
}
