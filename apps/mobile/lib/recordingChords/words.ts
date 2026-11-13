import type { TranslateFn } from "@/lib/i18n"

import type { SheetFailure } from "./types"

/** The sentence a person is told for each failure of a chord sheet (locales/recordingExtras.ts, `recChordsForm.failure.*`). */
export function sheetFailureText(tr: TranslateFn, failure: SheetFailure): string {
  return tr(`recChordsForm.failure.${failure}`)
}

/** What stops a draft from being sent, as a sentence (`recChordsForm.problem.*`; any other failure uses its own words). */
export function draftProblemText(tr: TranslateFn, problem: SheetFailure | "notPlayed" | "badKey" | "noteTooLong"): string {
  switch (problem) {
    case "notPlayed":
    case "badKey":
    case "noteTooLong":
    case "noChords":
    case "fewChords":
    case "tooLong":
    case "links":
      return tr(`recChordsForm.problem.${problem}`)
    default:
      return sheetFailureText(tr, problem)
  }
}
