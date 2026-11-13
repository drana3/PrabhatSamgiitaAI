import { capoNote, harmoniumShift, shapeChord, transposeChord } from "./chords"

/**
 * Chord content contract (spec API-07 / API-14). Chords are never generated at
 * read time: a chart is used only when it is marked reviewed.
 */
export type ChordPlacement = {
  /** zero-based index of the word in the lyric line */
  word: number
  /** the SOUNDING chord, in the key the recording is played in */
  chord: string
}

export type ChordChart = {
  reviewed: boolean
  /** key of the chart (Sa for the harmonium) */
  baseKey?: string
  /** strum pattern, given once above the lyric */
  strum?: string
  /** one entry per lyric line, in lyric order */
  lines: Array<{ placements: ChordPlacement[] }>
}

export type ChordInstrument = "guitar" | "harmonium"
export type ChordMode = "shapes" | "sounding"

export function chartIsUsable(chart: ChordChart | null | undefined): chart is ChordChart {
  if (!chart || !chart.reviewed) return false
  return chart.lines.some((line) => line.placements.length > 0)
}

/** Every chord of the chart once, in the order the player meets them. */
export function chordsUsed(chart: ChordChart): string[] {
  const seen: string[] = []
  for (const line of chart.lines) {
    for (const placement of line.placements) {
      if (!seen.includes(placement.chord)) seen.push(placement.chord)
    }
  }
  return seen
}

export type ChordDisplay = {
  instrument: ChordInstrument
  capo: number
  mode: ChordMode
  /** harmonium Sa */
  key: string
}

/** The letter printed above a word. */
export function displayChord(chord: string, display: ChordDisplay, baseKey?: string): string {
  if (display.instrument === "harmonium") {
    return transposeChord(chord, harmoniumShift(baseKey, display.key))
  }
  return display.mode === "shapes" ? shapeChord(chord, display.capo) : chord
}

export type WordColumn = { word: string; chord: string | null }

export function splitWords(line: string): string[] {
  return line.split(/\s+/).filter(Boolean)
}

/**
 * Lay a line out as columns: each word with the chord (if any) that changes on it.
 * A chord appears only where it changes, so a repeat of the previous chord is dropped.
 */
export function wordColumns(
  line: string,
  placements: ChordPlacement[],
  previousChord: string | null,
  show: (chord: string) => string,
): { columns: WordColumn[]; lastChord: string | null } {
  const words = splitWords(line)
  const byWord = new Map<number, string>()
  for (const p of placements) {
    if (p.word >= 0 && p.word < words.length && !byWord.has(p.word)) byWord.set(p.word, p.chord)
  }
  let last = previousChord
  const columns = words.map((word, index) => {
    const chord = byWord.get(index) ?? null
    if (chord && chord !== last) {
      last = chord
      return { word, chord: show(chord) }
    }
    return { word, chord: null }
  })
  return { columns, lastChord: last }
}

/** One line under the lyric: `Guitar, capo 5`, `Guitar, no capo`, `Harmonium, Sa = D`. */
export function chordSummary(display: ChordDisplay): string {
  if (display.instrument === "harmonium") return `Harmonium, Sa = ${display.key}`
  if (display.capo === 0) return "Guitar, no capo"
  return `Guitar, capo ${display.capo}`
}

export function capoHeadline(capo: number): string {
  return capoNote(capo) || "No capo"
}

/**
 * Columns for every lyric line, carrying the "only where it changes" rule from one line to the next.
 * `repeatAtLineStart` writes the chord at the start of every line even when the line before ended on it
 * (the design prototype does).
 */
export function layoutChart(
  romanLines: string[],
  chart: ChordChart,
  show: (chord: string) => string,
  repeatAtLineStart = false,
): WordColumn[][] {
  let previous: string | null = null
  return romanLines.map((line, index) => {
    const placements = chart.lines[index]?.placements ?? []
    const result = wordColumns(line, placements, repeatAtLineStart ? null : previous, show)
    previous = result.lastChord
    return result.columns
  })
}

/**
 * Show the same chords over a line written in another script. Possible only when
 * both lines have the same number of words; otherwise null (no guessing).
 */
export function columnsInScript(columns: WordColumn[], scriptLine: string): WordColumn[] | null {
  const words = splitWords(scriptLine)
  if (words.length !== columns.length) return null
  return columns.map((column, i) => ({ word: words[i], chord: column.chord }))
}
