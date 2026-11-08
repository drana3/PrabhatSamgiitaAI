import type { TranslateFn } from "@/lib/i18n"

import type { PianoFailure } from "./types"

/** The sentence a person is told for each failure of piano notes (locales/pianoNotes.ts, `piano.failure.*`). */
export function pianoFailureText(tr: TranslateFn, failure: PianoFailure): string {
  return tr(`piano.failure.${failure}`)
}
