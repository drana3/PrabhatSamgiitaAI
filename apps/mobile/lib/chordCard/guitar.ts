import { chordSpec, type ChordKind, type ChordSpec } from "./theory"

/**
 * Guitar fingering of a chord, for the chord card (docs/chord-card.md). Standard tuning E A D G B E.
 *
 * A fingering is six numbers, low E string first: `-1` = not played, `0` = open string, `n` = fret n. Two sources:
 *  1. the open shapes everybody learns first (C, D, E, G, A, Am, Em, Dm, the open sevenths ...), written down by hand;
 *  2. otherwise a movable shape: the "E shape" (root on the low E string) or the "A shape" (root on the A string), slid
 *     up to the root; the lower fret wins.
 * Tests play every fingering back through the tuning and check that it sounds exactly the notes of the chord
 * (__tests__/chordCard.test.ts); a wrong fret cannot get in unnoticed.
 */

/** Open strings of a standard guitar as MIDI notes: E2 A2 D3 G3 B3 E4. */
export const GUITAR_TUNING = [40, 45, 50, 55, 59, 64] as const

export type Fingering = {
  /** six values, low E first: -1 muted, 0 open, n fret n */
  frets: readonly number[]
  /** true when a finger lies across several strings (a barre chord) */
  barre: boolean
  /** an open shape (no barre, at least one open string) */
  open: boolean
}

const parse = (text: string): number[] => text.split("").map((ch) => (ch === "x" ? -1 : Number.parseInt(ch, 16)))

/** Hand-written open shapes, keyed by the chord as written with a sharp spelling and plain suffix. */
const OPEN: Record<string, string> = {
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
  Gadd9: "320203",
  A: "x02220",
  Am: "x02210",
  A7: "x02020",
  Am7: "x02010",
  Amaj7: "x02120",
  Asus2: "x02200",
  Asus4: "x02230",
  Adim: "x0121x",
  B7: "x21202",
}

/** Movable shapes. `f` is the fret the root is on. `x` = not played. Offsets are added to `f`. */
type Template = ReadonlyArray<number | "x">
const E_SHAPE: Partial<Record<ChordKind, Template>> = {
  major: [0, 2, 2, 1, 0, 0],
  minor: [0, 2, 2, 0, 0, 0],
  dom7: [0, 2, 0, 1, 0, 0],
  min7: [0, 2, 0, 0, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
  sus4: [0, 2, 2, 2, 0, 0],
  aug: [0, 3, 2, 1, 1, 0],
}
const A_SHAPE: Partial<Record<ChordKind, Template>> = {
  major: ["x", 0, 2, 2, 2, 0],
  minor: ["x", 0, 2, 2, 1, 0],
  dom7: ["x", 0, 2, 0, 2, 0],
  min7: ["x", 0, 2, 0, 1, 0],
  maj7: ["x", 0, 2, 1, 2, 0],
  sus2: ["x", 0, 2, 2, 0, 0],
  sus4: ["x", 0, 2, 2, 3, 0],
  dim: ["x", 0, 1, 2, 1, "x"],
  add9: ["x", 0, 2, 4, 2, 0],
}

const mod12 = (n: number) => ((n % 12) + 12) % 12

/** The key used for the hand-written table: root with a sharp, plus the suffix. */
function openKey(spec: ChordSpec): string {
  const sharpRoot = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][spec.rootPitchClass]!
  const suffix = spec.kind === "major" ? "" : spec.name.slice(spec.root.length).replace(/\/.*$/, "")
  return `${sharpRoot}${suffix}`
}

function slide(template: Template, fret: number): number[] {
  return template.map((offset) => (offset === "x" ? -1 : fret + offset))
}

/** The fingering of a chord, or `null` for a chord with no picture (an unsupported kind). A slash chord is drawn as its plain chord. */
export function guitarFingering(text: string): Fingering | null {
  const spec = chordSpec(text)
  if (!spec) return null
  const open = OPEN[openKey(spec)]
  if (open) {
    const frets = parse(open)
    return { frets, barre: false, open: frets.includes(0) }
  }
  const e = E_SHAPE[spec.kind]
  const a = A_SHAPE[spec.kind]
  const eFret = mod12(spec.rootPitchClass - 4)
  const aFret = mod12(spec.rootPitchClass - 9)
  // the lower position wins; a shape that does not exist for this kind is out; a tie goes to the E shape
  const pickE = e && (!a || eFret <= aFret)
  const template = pickE ? e : a
  if (!template) return null
  const fret = pickE ? eFret : aFret
  const frets = slide(template, fret)
  // fret 0 would be an open shape: the table above holds those, so a zero here is only a template that happens to be open
  return { frets, barre: fret > 0, open: fret === 0 }
}

/** Pitch classes sounded by a fingering in standard tuning (muted strings sound nothing). */
export function fingeringPitchClasses(frets: readonly number[]): number[] {
  const out: number[] = []
  frets.forEach((fret, string) => {
    if (fret < 0) return
    const pc = mod12(GUITAR_TUNING[string]! + fret)
    if (!out.includes(pc)) out.push(pc)
  })
  return out
}

/** The lowest sounding pitch class (the bass), or null when every string is muted. */
export function fingeringBass(frets: readonly number[]): number | null {
  for (let string = 0; string < 6; string += 1) {
    const fret = frets[string]!
    if (fret >= 0) return mod12(GUITAR_TUNING[string]! + fret)
  }
  return null
}

/** What a diagram needs: first fret shown, the dots, the open and muted strings and the barre. */
export type Diagram = {
  /** the fret number of the first row (1 when the nut is drawn) */
  baseFret: number
  /** number of fret rows drawn (5) */
  rows: number
  dots: Array<{ string: number; row: number }>
  open: number[]
  muted: number[]
  /** a bar across strings `from`..`to` on `row` (1-based within the window) */
  barre: { row: number; from: number; to: number } | null
}

export const DIAGRAM_ROWS = 5

/** `allowBarre` is false for an open shape: its fingers above the nut are separate fingers, not one bar. */
export function diagramOf(frets: readonly number[], allowBarre = true): Diagram {
  const pressed = frets.filter((f) => f > 0)
  const lowest = pressed.length ? Math.min(...pressed) : 1
  const highest = pressed.length ? Math.max(...pressed) : 1
  const baseFret = highest <= DIAGRAM_ROWS ? 1 : lowest
  const dots: Diagram["dots"] = []
  const open: number[] = []
  const muted: number[] = []
  frets.forEach((fret, string) => {
    if (fret < 0) muted.push(string)
    else if (fret === 0) open.push(string)
    else dots.push({ string, row: fret - baseFret + 1 })
  })
  // a barre: the lowest fret is pressed on three or more strings, none lower than it is open or pressed between the ends
  let barre: Diagram["barre"] = null
  if (pressed.length && allowBarre) {
    const on = frets.flatMap((f, i) => (f === lowest ? [i] : []))
    const from = Math.min(...on)
    const to = Math.max(...on)
    const between = frets.slice(from, to + 1).every((f) => f >= lowest)
    if (to - from >= 2 && between && lowest > 0) barre = { row: lowest - baseFret + 1, from, to }
  }
  return { baseFret, rows: DIAGRAM_ROWS, dots, open, muted, barre }
}
