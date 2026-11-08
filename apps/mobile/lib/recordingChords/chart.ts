import { draftProblems, newDraft, soundingKey, soundingLines, type Draft, type DraftProblem } from "@/lib/songChords/draft"
import { shiftChord } from "@/lib/songChords/spelling"
import { linkCount, stripInvisible } from "@/lib/songComments/rules"
import { splitWords } from "@/lib/songPage/chordChart"

import { SHEET_MAX_LINE_LENGTH, SHEET_MAX_LINES, SHEET_MAX_LENGTH } from "./rules"
import type { RecordingSheet, SheetChartPayload } from "./types"

/**
 * The chord chart of a Bhajan or a Spiritual song, as the editor holds it. A recording has no lyrics of its own, so the
 * member pastes the text of the song and the chart keeps it beside the chords (apps/api services/recording_chords.py).
 * The chords are the Prabhat Samgiita editor's own: a `Draft` (the key, the capo, the shapes a guitar player enters, one
 * list of placements per line) plus `text`, the lines of the song. Pure functions, so every rule is tested without a screen.
 */
export type ChartDraft = Draft & {
  /** the lines of the pasted text, as the server will keep them: words separated by one space, "" for a break between verses */
  text: string[]
}

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g

export type PasteProblem = "empty" | "lineTooLong" | "links" | "tooManyLines" | "tooLong"

/**
 * The pasted text as chart lines: invisible and control characters gone, runs of spaces and tabs collapsed, blank lines
 * at the ends dropped and no more than one blank line in a row. The same rules the server applies; it has the last word.
 */
export function pasteToLines(raw: string): { lines: string[] } | { problem: PasteProblem } {
  const cut = stripInvisible(raw).replace(/\r\n?/g, "\n").replace(/[\u2028\u2029]/g, "\n")
  const lines: string[] = []
  for (const piece of cut.split("\n")) {
    const text = piece.replace(CONTROL, " ").split(/\s+/).filter(Boolean).join(" ")
    if (!text && (lines.length === 0 || !lines[lines.length - 1])) continue
    lines.push(text)
  }
  while (lines.length && !lines[lines.length - 1]) lines.pop()
  if (lines.length === 0) return { problem: "empty" }
  if (lines.some((l) => Array.from(l).length > SHEET_MAX_LINE_LENGTH)) return { problem: "lineTooLong" }
  if (linkCount(lines.join("\n")) > 0) return { problem: "links" }
  if (lines.length > SHEET_MAX_LINES) return { problem: "tooManyLines" }
  if (lines.join("\n").length > SHEET_MAX_LENGTH) return { problem: "tooLong" }
  return { lines }
}

/** How many words each line has: the same count the chord slots and the server use. */
export function chartWordCounts(text: readonly string[]): number[] {
  return text.map((line) => splitWords(line).length)
}

export function newChartDraft(): ChartDraft {
  return { ...newDraft(null), text: [] }
}

/**
 * Put new text under the chords. A line that is the same as before (same text, same place) keeps its chords; a line that
 * changed, or a new one, starts empty, because a chord belongs to a word and the word may be gone.
 */
export function retext(draft: ChartDraft, text: readonly string[]): ChartDraft {
  const lines = text.map((line, i) => (draft.text[i] === line ? (draft.lines[i] ?? []) : []))
  return { ...draft, text: [...text], lines }
}

/** What would be lost if the text changed to `text`: the number of chords on lines that would change. */
export function chordsLostBy(draft: ChartDraft, text: readonly string[]): number {
  return draft.lines.reduce((sum, line, i) => sum + (draft.text[i] === text[i] ? 0 : line.length), 0)
}

export type ChartProblem = DraftProblem | "noText"

/** Everything that stops a chart from being sent, in the order the form meets it. */
export function chartProblems(draft: ChartDraft): ChartProblem[] {
  const out: ChartProblem[] = []
  if (!draft.text.some(Boolean)) out.push("noText")
  out.push(...draftProblems(draft, chartWordCounts(draft.text), { needsSong: false }))
  return out
}

/** The request: SOUNDING chords, the text of each line beside them, the capo as a hint. Throws on an unfinished chart. */
export function toChartPayload(draft: ChartDraft): SheetChartPayload {
  const counts = chartWordCounts(draft.text)
  const placed = soundingLines(draft, counts)
  const lines = draft.text.map((text, i) => ({ text, placements: placed[i]?.placements ?? [] }))
  const strum = draft.instrument === "guitar" ? draft.strum.replace(/\s+/g, " ").trim() : ""
  const note = draft.note.trim()
  return {
    instrument: draft.instrument,
    baseKey: soundingKey(draft),
    capo: draft.instrument === "guitar" ? draft.capo : 0,
    strum: strum || null,
    lines,
    playedIt: draft.playedIt,
    note: note || null,
    isAnonymous: draft.isAnonymous,
    ...(draft.basedOn ? { replacesId: draft.basedOn } : {}),
    ...(draft.startedFrom && !draft.editId && !draft.basedOn ? { basedOnId: draft.startedFrom } : {}),
  }
}

/** A sheet that is a chart, as the proposal shape the Prabhat Samgiita chart view draws (its text is `lyrics`). */
export function isChart(sheet: Pick<RecordingSheet, "lines">): boolean {
  return Boolean(sheet.lines && sheet.lines.length > 0)
}

/**
 * The editor's draft for a chart that already exists: the other way round of `toChartPayload`. A guitar chart is stored as
 * SOUNDING chords and the editor works in the SHAPES, so every chord and the key go down by the capo. `how`: "edit"
 * updates this very chart (a waiting or rejected one), "copy" offers a changed copy of a live one (it replaces it).
 */
export function chartDraftFromSheet(sheet: RecordingSheet, how: "edit" | "copy"): ChartDraft {
  const capo = sheet.instrument === "guitar" ? (sheet.capo ?? 0) : 0
  const shape = (chord: string) => (capo > 0 ? shiftChord(chord, -capo) : chord)
  const lines = sheet.lines ?? []
  return {
    ...newDraft(null),
    instrument: sheet.instrument,
    key: shiftChord(sheet.chartKey ?? "D", -capo),
    capo,
    strum: sheet.instrument === "guitar" ? (sheet.strum ?? "") : "",
    lines: lines.map((line) => line.placements.map((p) => ({ word: p.word, chord: shape(p.chord) }))),
    text: lines.map((line) => line.text),
    playedIt: sheet.playedIt,
    note: sheet.note ?? "",
    isAnonymous: sheet.isAnonymous,
    editId: how === "edit" ? sheet.id : null,
    basedOn: how === "copy" ? sheet.id : null,
  }
}

/**
 * Someone else's published chart as the start of a NEW chart of the member's own: the TEXT and the CHORDS come over, the
 * capo and the strum do not (the chords are as they sound; the member sets what they play). Nothing is confirmed: the
 * member has not played or checked them yet. `startedFrom` carries the credit.
 */
export function chartDraftFromOther(sheet: RecordingSheet): ChartDraft {
  const base = chartDraftFromSheet({ ...sheet, capo: 0, strum: null }, "copy")
  return { ...base, playedIt: false, note: "", isAnonymous: false, editId: null, basedOn: null, startedFrom: sheet.id }
}

/** The chart written as plain text with the chords inside the words, `[Am]Baba Nam [G]Kevalam`: what the server keeps as `body`. */
export function chartBody(lines: ReadonlyArray<{ text: string; placements: ReadonlyArray<{ word: number; chord: string }> }>): string {
  return lines
    .map((line) => {
      const at = new Map(line.placements.map((p) => [p.word, p.chord]))
      return splitWords(line.text)
        .map((word, i) => (at.has(i) ? `[${at.get(i)}]${word}` : word))
        .join(" ")
    })
    .join("\n")
}
