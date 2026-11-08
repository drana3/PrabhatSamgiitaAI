import { formatSargamLine, parseSargamLine } from "./sargamText"
import { MAX_LABEL, MAX_ROWS } from "./rules"
import type { PianoDraft, PianoHand, PianoRow, PianoSheet } from "./types"

/** One row as the editor holds it: the text line is the truth, the steps are read from it when sending. */
export type EditorRow = { label: string; repeat: number; hand: PianoHand; text: string }

export const newEditorRow = (hand: PianoHand = "right"): EditorRow => ({ label: "", repeat: 1, hand, text: "" })

export function editorRowsOf(sheet: PianoSheet): EditorRow[] {
  return sheet.rows.map((row) => ({ label: row.label ?? "", repeat: row.repeat, hand: row.hand, text: formatSargamLine(row.steps) }))
}

/** `Sa Re ` plus the token, keeping the line tidy. */
export function appendToken(text: string, token: string): string {
  const trimmed = text.trimEnd()
  return trimmed ? `${trimmed} ${token}` : token
}

/** The line without its last word (a chord in brackets counts as one word). */
export function dropLastToken(text: string): string {
  const trimmed = text.trimEnd()
  const match = /(?:\([^)]*\)(?::[\d.]+)?|\S+)$/.exec(trimmed)
  return match ? trimmed.slice(0, match.index).trimEnd() : ""
}

export type EditorProblem = { row: number; bad: string[] }

/** The rows of the editor as sheet rows, and the words that were not understood (nothing is sent while there are any). Empty rows are left out. */
export function rowsFromEditor(rows: readonly EditorRow[]): { rows: PianoRow[]; problems: EditorProblem[] } {
  const out: PianoRow[] = []
  const problems: EditorProblem[] = []
  rows.forEach((row, index) => {
    if (!row.text.trim()) return
    const parsed = parseSargamLine(row.text)
    if (parsed.bad.length > 0) problems.push({ row: index, bad: parsed.bad })
    out.push({ label: row.label.trim().slice(0, MAX_LABEL) || null, repeat: row.repeat, hand: row.hand, steps: parsed.steps })
  })
  return { rows: out.slice(0, MAX_ROWS), problems }
}

export function draftFromEditor(input: { saKey: string; rows: PianoRow[]; linkUrl: string; note: string; isAnonymous: boolean; replacesId?: string | null; basedOnId?: string | null }): PianoDraft {
  return { ...input, replacesId: input.replacesId ?? null, basedOnId: input.basedOnId ?? null }
}

export const BEAT_CHOICES = [0.5, 1, 2, 4] as const
