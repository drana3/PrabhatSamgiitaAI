import { kindHasChords, normalizeKind } from "@/lib/kirtan/kind"
import { kindHasByAuthor } from "@/lib/kirtan/recordingInfo"
import type { RecordingKind } from "@/lib/kirtan/types"
import { kindHasCharts } from "@/lib/recordingChords/kinds"
import type { SheetInstrument } from "@/lib/recordingChords/types"

/**
 * The chords, the piano notes and the roles of the Add Recording form (Dada, 13 Nov 2026). Pure, so it is unit tested
 * (__tests__/uploadChords.test.ts).
 *
 * A recording does not exist on the server until its file is up, so what is typed here waits in two small stores
 * (stores/recordingChordsPendingStore.ts for chords, stores/pianoNotesPendingStore.ts for piano notes) under the keys below, and goes
 * to the recording once it is published. It is never a condition of the upload: an empty section sends nothing, and a section that
 * cannot be sent leaves one honest line with "Send again" (the recording stays).
 */

/** The row key under which the form's own chords wait (the form has one recording's worth of chords: the FIRST file's). */
export const FORM_KEY = "form"
export const formChordKey = (instrument: SheetInstrument): string => `${FORM_KEY}:${instrument}`
export const FORM_NOTES_KEY = `${FORM_KEY}:notes`

/** The instruments of the section, in the order Dada asked for them on the form: Guitar, Harmonium, Piano. */
export const FORM_INSTRUMENTS: readonly SheetInstrument[] = ["guitar", "harmonium", "piano"]

/** Does the form show the chords section for this kind? Every kind but Dance music and Baba's Audio Discourses. */
export function formOffersChords(kind: RecordingKind | string | null | undefined): boolean {
  return kindHasChords(normalizeKind(kind))
}

/**
 * How a kind writes its chords on the form: `chart` (Bhajan, Spiritual song: the words with a chord over each word, on the
 * "Words and chords" screen) or `text` (Kiirtan, Prabhat Samgiita: the chords as plain text, typed right in the form).
 */
export function chordsFormMode(kind: RecordingKind | string | null | undefined): "chart" | "text" | null {
  if (!formOffersChords(kind)) return null
  return kindHasCharts(kind) ? "chart" : "text"
}

/** A short list "Guitar, Piano" of the instruments that hold something, in the form's order. */
export function filledList(has: Readonly<Record<SheetInstrument, boolean>>, label: (instrument: SheetInstrument) => string, notes: boolean, notesLabel: string): string {
  const names = FORM_INSTRUMENTS.filter((instrument) => has[instrument]).map(label)
  if (notes) names.push(notesLabel)
  return names.join(", ")
}

/* ------------------------------------------------------------------ the two roles */

/**
 * The two independent ticks that sit with the performer's name:
 *  - `wrote` ("I wrote this: words or melody") is the API's `by_author`; not for Prabhat Samgiita (one author), Baba's Audio or Others;
 *  - `performs` ("I perform or play on this recording") has NO field on the server. It is kept on the form and does one thing:
 *    it puts the person's own name in the performer line when that line is empty.
 * Where a recording shows up does not depend on either tick: an author page lists every recording its owner uploaded
 * (apps/api services/author_profiles.py `attribution`), and a recording somebody else added is claimed from "Find my recordings".
 */
export function showsWroteTick(kind: RecordingKind | string | null | undefined): boolean {
  return kindHasByAuthor(kind as string)
}

/** The patch the form applies when "I perform or play" is switched: on, with the person's own name filled in when the line is empty. */
export function performsPatch(draft: { performer: string }, on: boolean, ownName: string | null | undefined): { performs: boolean; performer?: string } {
  const name = (ownName ?? "").trim()
  if (on && !draft.performer.trim() && name && name !== "Guest") return { performs: true, performer: name }
  return { performs: on }
}
