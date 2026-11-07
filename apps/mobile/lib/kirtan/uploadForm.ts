import { kindHasCredits, kindHasLanguage } from "@/lib/kirtan/kind"
import type { RecordingKind, RecordingLanguage } from "@/lib/kirtan/types"

/**
 * The rules of the add-recording form that depend on the type. Pure, so they are unit tested
 * (__tests__/uploadForm.test.ts) and the form, the queue store and the submission all use the same ones:
 *  - the sung LANGUAGE is asked for a Bhajan and a Prabhat Samgiita recording, never for a Kiirtan (LANGUAGE_KINDS);
 *  - "words and music by" is asked for a Bhajan only;
 *  - the song number belongs to a Prabhat Samgiita recording only.
 * Changing the type clears the fields the new type does not have, so nothing hidden is ever sent.
 */

type TypeFields = {
  kind: RecordingKind
  language: RecordingLanguage | null
  credits: string
  psSong: { number: number; title: string } | null
}

/** The draft after `patch`: the type's own rules applied, whatever the patch said. */
export function draftWithPatch<T extends TypeFields>(draft: T, patch: Partial<T>): T {
  const next = { ...draft, ...patch }
  if (!kindHasLanguage(next.kind)) next.language = null
  if (!kindHasCredits(next.kind)) next.credits = ""
  if (next.kind !== "prabhat_samgiita") next.psSong = null
  return next
}

/** Which optional fields "More details" shows for a type. */
export function moreDetailsFor(kind: RecordingKind): { language: boolean; credits: boolean } {
  return { language: kindHasLanguage(kind), credits: kindHasCredits(kind) }
}

/** The key of the one-line hint under the closed "More details" header, in the words of the type. */
export function moreDetailsHintKey(kind: RecordingKind): `rec.more.hint.${RecordingKind}` {
  return `rec.more.hint.${kind}`
}
