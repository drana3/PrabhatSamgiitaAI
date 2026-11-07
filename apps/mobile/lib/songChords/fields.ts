import type { DraftProblem } from "./draft"

/**
 * Which field of the offer form each problem belongs to, and the order the form meets them in (top to bottom). When
 * Send is pressed with something missing, the screen jumps to the FIRST field in this order and says what is wrong
 * under it. Pure, so the order is tested without a screen.
 */
export type FormField = "song" | "strum" | "chords" | "note" | "played"

/** The fields in the order they sit on the screen. */
export const FIELD_ORDER: readonly FormField[] = ["song", "chords", "strum", "note", "played"]

const FIELD_OF: Record<DraftProblem, FormField> = {
  noSong: "song",
  strumShape: "strum",
  noChords: "chords",
  badChord: "chords",
  noteTooLong: "note",
  notPlayed: "played",
}

export function fieldOf(problem: DraftProblem): FormField {
  return FIELD_OF[problem]
}

/** The problems of each field, in the order the draft reported them. */
export function problemsByField(problems: readonly DraftProblem[]): Partial<Record<FormField, DraftProblem[]>> {
  const out: Partial<Record<FormField, DraftProblem[]>> = {}
  for (const problem of problems) {
    const field = FIELD_OF[problem]
    out[field] = [...(out[field] ?? []), problem]
  }
  return out
}

/** The field the screen jumps to, with the problem it shows there; null when the form is complete. */
export function firstInvalid(problems: readonly DraftProblem[]): { field: FormField; problem: DraftProblem } | null {
  const by = problemsByField(problems)
  for (const field of FIELD_ORDER) {
    const found = by[field]
    if (found?.length) return { field, problem: found[0] }
  }
  return null
}
