import { cleanLanguageOther, OTHER_LANGUAGE } from "@/lib/kirtan/languages"
import { cleanInstrument, OTHER_INSTRUMENT } from "@/lib/kirtan/instruments"
import { cleanRecordingInfo, kindHasByAuthor } from "@/lib/kirtan/recordingInfo"
import { kindHasCredits, kindHasDance, kindHasDiscourse, kindHasLanguage, kindLanguageRule, kindRequiresLanguage } from "@/lib/kirtan/kind"
import type { DanceId, RecordingKind, RecordingLanguage } from "@/lib/kirtan/types"

/**
 * The rules of the add-recording form that depend on the type. Pure, so they are unit tested
 * (__tests__/uploadForm.test.ts) and the form, the queue store and the submission all use the same ones:
 *  - the sung LANGUAGE is asked for every kind but Kiirtan; it is REQUIRED for a Bhajan, a Spiritual song and a Baba's Audio Discourse (KIND_LANGUAGE_RULE);
 *  - "Other" names its language in words (`languageOther`), and the name is required once "Other" is chosen;
 *  - a Dance music names its DANCE (Tandava or Kaoshiki), and must;
 *  - "words and music by" is asked for a Bhajan only; the place and the discourse name or number for Baba's Audio only (no performer is asked there);
 *  - the song number belongs to a Prabhat Samgiita recording only.
 * Changing the type clears the fields the new type does not have, so nothing hidden is ever sent.
 */

type TypeFields = {
  kind: RecordingKind
  language: RecordingLanguage | null
  languageOther: string
  dance: DanceId | null
  credits: string
  place: string
  discourse: string
  psSong: { number: number; title: string } | null
  /** Kiirtan only: the style (lib/kirtan/styles.ts; REQUIRED for a Kiirtan); forms without it leave these out */
  style?: string | null
  styleOther?: string
  /** Kiirtan only: "avarta" marks an Avarta Kiirtan (lib/kirtan/practice.ts); forms without it leave it out */
  practice?: string | null
  /** how it was recorded, the tempo, solo or group (lib/kirtan/recordingInfo.ts); forms without them leave them out */
  recordingType?: string | null
  tempo?: string | null
  performance?: string | null
  /** the main instrument (lib/kirtan/instruments.ts); forms without it leave it out */
  leadInstrument?: string | null
  leadInstrumentOther?: string
  /** the tick "I am the author of the recording" (not offered for Prabhat Samgiita or Baba's Audio Discourses) */
  byAuthor?: boolean
}

/** The draft after `patch`: the type's own rules applied, whatever the patch said. */
export function draftWithPatch<T extends TypeFields>(draft: T, patch: Partial<T>): T {
  const next = { ...draft, ...patch }
  if (!kindHasLanguage(next.kind)) next.language = null
  if (next.language !== OTHER_LANGUAGE) next.languageOther = ""
  if (!kindHasDance(next.kind)) next.dance = null
  if (!kindHasCredits(next.kind)) next.credits = ""
  if (!kindHasDiscourse(next.kind)) {
    next.place = ""
    next.discourse = ""
  }
  if (next.kind !== "prabhat_samgiita") next.psSong = null
  if (next.kind !== "kiirtan" && "style" in next) {
    ;(next as TypeFields).style = null
    ;(next as TypeFields).styleOther = ""
  }
  if (next.kind !== "kiirtan" && "practice" in next) (next as TypeFields).practice = null
  // the recording info follows the type too: a field the new type does not carry goes, and an AI recording is not a Bhajan
  if ("recordingType" in next || "tempo" in next || "performance" in next) {
    const fields = next as TypeFields
    // switching the type starts these afresh: how a Kiirtan was recorded says nothing about the Bhajan chosen next
    if (next.kind !== draft.kind) {
      fields.recordingType = null
      fields.tempo = null
      fields.performance = null
    }
    const clean = cleanRecordingInfo(next.kind, fields)
    if ("recordingType" in next) fields.recordingType = clean.recordingType
    if ("tempo" in next) fields.tempo = clean.tempo
    if ("performance" in next) fields.performance = clean.performance
  }
  // the main instrument: only music has one; "other" keeps its word, a listed instrument does not
  if ("leadInstrument" in next) {
    const fields = next as TypeFields
    if (next.kind !== draft.kind) {
      fields.leadInstrument = null
      fields.leadInstrumentOther = ""
    }
    const clean = cleanInstrument(next.kind, fields.leadInstrument, fields.leadInstrumentOther ?? "")
    fields.leadInstrument = clean.instrument
    // while the person types the word the field keeps it as it is (no trimming under the finger)
    if (fields.leadInstrument !== OTHER_INSTRUMENT) fields.leadInstrumentOther = ""
  }
  // the author tick is not offered for Prabhat Samgiita or Baba's Audio Discourses
  if ("byAuthor" in next && !kindHasByAuthor(next.kind)) (next as TypeFields).byAuthor = false
  return next
}

/** Which optional fields "More details" shows for a type (a language that is REQUIRED sits above it, not in it). */
export function moreDetailsFor(kind: RecordingKind): { language: boolean; credits: boolean; discourse: boolean } {
  return { language: kindLanguageRule(kind) === "optional", credits: kindHasCredits(kind), discourse: kindHasDiscourse(kind) }
}

/** The key of the one-line hint under the closed "More details" header, in the words of the type. */
export function moreDetailsHintKey(kind: RecordingKind): `rec.more.hint.${RecordingKind}` {
  return `rec.more.hint.${kind}`
}

/** The key of the sentence that asks for the language: a discourse of Baba is "this discourse", the rest "this song". */
export function languageErrorKey(kind: RecordingKind): string {
  return kind === "baba_audio" ? "ugc.form.error.language.baba_audio" : "ugc.form.error.language"
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
