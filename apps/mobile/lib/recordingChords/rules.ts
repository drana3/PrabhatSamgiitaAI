import { isChordName } from "@/lib/songChords/chordName"
import { linkCount, stripInvisible } from "@/lib/songComments/rules"

import type { SheetChartPayload, SheetDraft, SheetFailure } from "./types"

/** The same limits as the API (apps/api/app/models/recording_extras.py, services/recording_chords.py). */
export const SHEET_MAX_LENGTH = 8000
export const SHEET_MAX_LINES = 250
export const SHEET_MAX_LINE_LENGTH = 120
export const SHEET_MAX_CHORDS = 2000
export const SHEET_NOTE_MAX = 300
/** One member keeps at most this many live (waiting or published) sheets per recording and instrument. */
export const OPEN_PER_RECORDING_INSTRUMENT = 3
/** A key as a note name with an optional minor mark: C, F#, Bb, Am, F#m. */
export const KEY_PATTERN = /^[A-G][#b]?m?$/
export const KEYS: readonly string[] = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

/** Marks that may sit between chords on a chord line without making it a line of words (the API's list). */
const SEPARATOR = /^(?:\|{1,2}|[-–—/%:]|\(?[xX]\d{1,2}\)?|N\.?C\.?|\.{2,})$/
const INLINE = /\[([^\][\s]{1,16})\]/g
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g

/** How many chords a CHORD LINE holds: a line made only of chords and the usual separators (bars, dashes, "x2", "N.C."). 0 for a line of words or an empty line. */
export function chordLineCount(line: string): number {
  const tokens = line.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0
  let chords = 0
  for (const token of tokens) {
    if (isChordName(token)) chords += 1
    else if (!SEPARATOR.test(token)) return 0
  }
  return chords
}

/** The chords of a CHORD LINE (empty for a line of words). */
export function chordLineTokens(line: string): string[] {
  const tokens = line.split(/\s+/).filter(Boolean)
  const chords: string[] = []
  for (const token of tokens) {
    if (isChordName(token)) chords.push(token)
    else if (!SEPARATOR.test(token)) return []
  }
  return chords
}

/** Chords on one line: the chord line's tokens, or the `[Am]` marks inside words. */
export function lineChordTokens(line: string): string[] {
  const onLine = chordLineTokens(line)
  return onLine.length ? onLine : Array.from(line.matchAll(INLINE)).map((m) => m[1] as string).filter((name) => isChordName(name))
}

export function lineChords(line: string): number {
  return lineChordTokens(line).length
}

/** A chord that is only a letter with an optional sharp or flat ("A", "Bb"): on its own it is also a word. */
const PLAIN_CHORD = /^[A-G][#b♯♭]?$/

/**
 * A chart needs more than one lonely letter: at least two DIFFERENT chords, or one chord that is plainly a chord (a
 * quality, a number or a bass note: Am, G7, D/F#). So "Am" over words and "Am" + "G" pass; a body of just "A" does not.
 * The API applies the same rule and has the final say.
 */
export function provesAChart(chords: readonly string[]): boolean {
  return new Set(chords).size >= 2 || chords.some((name) => !PLAIN_CHORD.test(name))
}

function dedent(lines: string[]): string[] {
  const margins = lines.filter((l) => l.trim()).map((l) => (/^ */.exec(l) as RegExpExecArray)[0].length)
  const cut = margins.length ? Math.min(...margins) : 0
  return lines.map((l) => l.slice(Math.min(cut, l.length - l.trimStart().length)))
}

export type CleanSheet = { body: string; chords: number }

/**
 * The text as the server will keep it, and how many chords it holds; or the first problem. Invisible and control
 * characters go; tabs and odd spaces become ordinary spaces (chords are lined up over words by their columns); line ends
 * are trimmed, a common left margin is removed, no more than one blank line in a row stays. Spaces INSIDE a line stay.
 */
export function cleanSheet(raw: string): CleanSheet | { problem: SheetFailure } {
  let text = stripInvisible(raw).replace(/\r\n?/g, "\n").replace(/[\u2028\u2029]/g, "\n").replace(/\t/g, "    ")
  text = text.replace(CONTROL, "").replace(/\p{Zs}/gu, " ")
  const collapsed: string[] = []
  for (const line of text.split("\n").map((l) => l.replace(/\s+$/, ""))) {
    if (!line && (collapsed.length === 0 || !collapsed[collapsed.length - 1])) continue
    collapsed.push(line)
  }
  while (collapsed.length && !collapsed[collapsed.length - 1]) collapsed.pop()
  const lines = dedent(collapsed)
  const body = lines.join("\n")
  if (!body.trim()) return { problem: "noChords" }
  if (lines.length > SHEET_MAX_LINES || lines.some((l) => l.length > SHEET_MAX_LINE_LENGTH) || body.length > SHEET_MAX_LENGTH) return { problem: "tooLong" }
  if (linkCount(body) > 0) return { problem: "links" }
  const found = lines.flatMap((l) => lineChordTokens(l))
  const chords = found.length
  if (chords === 0) return { problem: "noChords" }
  if (!provesAChart(found)) return { problem: "fewChords" }
  if (chords > SHEET_MAX_CHORDS) return { problem: "tooLong" }
  return { body, chords }
}

/** What stops a draft from being sent, in the order a person fixes it; null when it can go. */
export function draftProblem(draft: SheetDraft): SheetFailure | "notPlayed" | "badKey" | "noteTooLong" | null {
  if (draft.key.trim() && !KEY_PATTERN.test(draft.key.trim())) return "badKey"
  if (Array.from(draft.note.trim()).length > SHEET_NOTE_MAX) return "noteTooLong"
  // the note takes no web links, like the chart and a video title
  if (linkCount(stripInvisible(draft.note)) > 0) return "links"
  const cleaned = cleanSheet(draft.body)
  if ("problem" in cleaned) return cleaned.problem
  if (!draft.playedIt) return "notPlayed"
  return null
}

export function newSheetDraft(instrument: SheetDraft["instrument"] = "guitar"): SheetDraft {
  return { instrument, key: "", body: "", playedIt: false, note: "", isAnonymous: false }
}

/** True when the draft has nothing the person typed yet (so a collapsed prompt sends nothing). */
export function isBlankDraft(draft: SheetDraft): boolean {
  return !draft.body.trim()
}

/** The request body (snake_case) the API takes, text and note cleaned the way the server will clean them. */
export function draftToWire(draft: SheetDraft): Record<string, unknown> {
  const key = draft.key.trim()
  return {
    instrument: draft.instrument,
    chart_key: key || null,
    body: draft.body,
    played_it: draft.playedIt,
    note: draft.note.trim() || null,
    is_anonymous: draft.isAnonymous,
  }
}

/** The request body of a chart (snake_case): the lines of the text with their chords, the key they sound in, the capo as a hint. */
export function chartToWire(chart: SheetChartPayload): Record<string, unknown> {
  return {
    instrument: chart.instrument,
    chart_key: chart.baseKey,
    lines: chart.lines.map((line) => ({ text: line.text, placements: line.placements.map((p) => ({ word: p.word, chord: p.chord })) })),
    capo: chart.instrument === "guitar" ? chart.capo : 0,
    strum: chart.instrument === "guitar" ? chart.strum : null,
    played_it: chart.playedIt,
    note: chart.note?.trim() || null,
    is_anonymous: chart.isAnonymous,
    ...(chart.replacesId ? { replaces_id: chart.replacesId } : {}),
    ...(chart.basedOnId ? { based_on_id: chart.basedOnId } : {}),
  }
}
