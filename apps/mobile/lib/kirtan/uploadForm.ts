import { cleanLanguageOther, OTHER_LANGUAGE } from "@/lib/kirtan/languages"
import { kindHasCredits, kindHasDance, kindHasLanguage, kindLanguageRule, kindRequiresLanguage } from "@/lib/kirtan/kind"
import type { DanceId, RecordingKind, RecordingLanguage } from "@/lib/kirtan/types"

/**
 * The rules of the add-recording form that depend on the type. Pure, so they are unit tested
 * (__tests__/uploadForm.test.ts) and the form, the queue store and the submission all use the same ones:
 *  - the sung LANGUAGE is asked for every kind but Kiirtan; it is REQUIRED for a Bhajan and a Spiritual song (KIND_LANGUAGE_RULE);
 *  - "Other" names its language in words (`languageOther`), and the name is required once "Other" is chosen;
 *  - a Dance song names its DANCE (Tandava or Kaoshiki), and must;
 *  - "words and music by" is asked for a Bhajan only;
 *  - the song number belongs to a Prabhat Samgiita recording only.
 * Changing the type clears the fields the new type does not have, so nothing hidden is ever sent.
 */

type TypeFields = {
  kind: RecordingKind
  language: RecordingLanguage | null
  languageOther: string
  dance: DanceId | null
  credits: string
  psSong: { number: number; title: string } | null
}

/** The draft after `patch`: the type's own rules applied, whatever the patch said. */
export function draftWithPatch<T extends TypeFields>(draft: T, patch: Partial<T>): T {
  const next = { ...draft, ...patch }
  if (!kindHasLanguage(next.kind)) next.language = null
  if (next.language !== OTHER_LANGUAGE) next.languageOther = ""
  if (!kindHasDance(next.kind)) next.dance = null
  if (!kindHasCredits(next.kind)) next.credits = ""
  if (next.kind !== "prabhat_samgiita") next.psSong = null
  return next
}

/** Which optional fields "More details" shows for a type (a language that is REQUIRED sits above it, not in it). */
export function moreDetailsFor(kind: RecordingKind): { language: boolean; credits: boolean } {
  return { language: kindLanguageRule(kind) === "optional", credits: kindHasCredits(kind) }
}

/** The key of the one-line hint under the closed "More details" header, in the words of the type. */
export function moreDetailsHintKey(kind: RecordingKind): `rec.more.hint.${RecordingKind}` {
  return `rec.more.hint.${kind}`
}

/* ------------------------------------------------------------------ what a kind still needs */

/** `language`: not chosen; `languageName`: "Other" without its name; `dance`: not chosen. */
export type MissingField = "language" | "languageName" | "dance"

export type KindFields = {
  kind: RecordingKind
  language: RecordingLanguage | null | undefined
  languageOther?: string | null
  dance: DanceId | null | undefined
}

/**
 * What is still missing for the kind to be sendable, in the order the form shows it (language first, then the dance).
 * A Bhajan and a Spiritual song need their language; every kind that has a language needs the name once "Other" is chosen; a Dance
 * song needs its dance. The API refuses the same cases with a 422, so this is what the person is told first.
 */
export function missingKindFields(fields: KindFields): MissingField[] {
  const missing: MissingField[] = []
  if (kindRequiresLanguage(fields.kind) && !fields.language) missing.push("language")
  if (kindHasLanguage(fields.kind) && fields.language === OTHER_LANGUAGE && !cleanLanguageOther(fields.languageOther)) missing.push("languageName")
  if (kindHasDance(fields.kind) && !fields.dance) missing.push("dance")
  return missing
}

/** Is the field one of the REQUIRED ones for this kind (the form draws the "Required" marker next to it)? */
export function isRequiredField(kind: RecordingKind, field: "language" | "dance"): boolean {
  return field === "language" ? kindRequiresLanguage(kind) : kindHasDance(kind)
}
