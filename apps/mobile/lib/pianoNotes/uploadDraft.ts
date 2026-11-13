import { newEditorRow, rowsFromEditor, draftFromEditor } from "./editor"
import { validateDraft } from "./rules"
import type { PianoDraft, PianoFailure } from "./types"

/**
 * Piano notes typed on the Add Recording form, before the recording exists (the editor of the notes screen, app/piano-notes-edit.tsx,
 * in its smallest form): the key where Sa sits and the notes as text, one line = one row ("Sa Re Ga Ma:2 (Sa Ga Pa)"). Pure, so it is
 * unit tested (__tests__/pianoUploadDraft.test.ts). The text is read by the same parser as the editor (lib/pianoNotes/sargamText.ts).
 */
export type PianoUploadDraft = { saKey: string; text: string }

export const newPianoUploadDraft = (): PianoUploadDraft => ({ saKey: "C", text: "" })

/** Nothing typed yet: a collapsed or empty notes field sends nothing and never blocks the upload. */
export function isBlankPianoUpload(draft: PianoUploadDraft | null | undefined): boolean {
  return !draft || !draft.text.trim()
}

export type PianoUploadReading = {
  /** the words that were not understood, across all lines (nothing is sent while there are any) */
  bad: string[]
  /** how many notes (steps with a key) were read */
  notes: number
  /** the request as the API takes it, or null while the text is blank, has unknown words or the server would refuse it */
  draft: PianoDraft | null
  /** what stops it from being sent; null when it can go or is blank */
  problem: PianoFailure | "words" | null
}

/** The text read as a piano sheet: the draft to send and what is wrong with it (the same checks as the notes screen). */
export function readPianoUpload(input: PianoUploadDraft): PianoUploadReading {
  const lines = input.text.split(/\r?\n/)
  const built = rowsFromEditor(lines.map((text) => ({ ...newEditorRow(), text })))
  const bad = built.problems.flatMap((p) => p.bad)
  const notes = built.rows.reduce((total, row) => total + row.steps.filter((step) => step.k.length > 0).length, 0)
  if (built.rows.length === 0) return { bad, notes, draft: null, problem: null }
  const draft = draftFromEditor({ saKey: input.saKey, rows: built.rows, linkUrl: "", note: "", isAnonymous: false })
  if (bad.length > 0) return { bad, notes, draft: null, problem: "words" }
  const problem = validateDraft(draft)
  return { bad, notes, draft: problem ? null : draft, problem }
}
