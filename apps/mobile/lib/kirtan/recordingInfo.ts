import { t } from "@/lib/i18n"
import { instrumentLabel, isInstrumentId, OTHER_INSTRUMENT } from "@/lib/kirtan/instruments"
import { normalizeKind } from "@/lib/kirtan/kind"

/**
 * How a recording was made and how it sounds: the TYPE OF RECORDING, the TEMPO and SOLO or GROUP. These are the words the
 * team already sorts the library by on anandamarga.org/music; the ids are the same ones. ONE list, kept in step with the API
 * (`apps/api/app/services/recording_info.py`; `__tests__/recordingInfo.test.ts` and `apps/api/tests/test_recording_info.py`
 * pin the two sides). To add a value: add its id here and there and a label in en, ru and es. The database stores the id
 * only, so no migration is needed. Rules and sources: docs/kiirtan-recording-info.md.
 *
 *  - type of recording: EXACTLY three, `studio` (Studio recording), `live` (Live recording, a concert) and `ai` (AI-generated)
 *    (Dada, 9 Nov 2026). REQUIRED for a Kiirtan; optional for Dance music, a Bhajan, a Spiritual song, Prabhat Samgiita and Other
 *    mantras. Every kind that carries it takes `ai`; the listener is always told. The removed `home` (at home, on a phone) reads
 *    as `studio` (`normalizeRecordingType`): a draft or an older item that still says `home` keeps working.
 *  - tempo: Dance music ONLY (Dada, 9 Nov 2026): `slow`, `medium`, `fast` or `mix`. Optional. Every other kind drops it.
 *  - performance: `solo` or `group` (a group or a choir). REQUIRED for a Kiirtan, optional for a Bhajan and Other mantras.
 *  - "I am the author of the recording" (`byAuthor`): every kind but Prabhat Samgiita (it has one author), Baba's Audio
 *    Discourses and Other mantras (a mantra is not composed by the uploader).
 *
 * Also here: the title of a Kiirtan is written in English (Latin letters), so one alphabet serves the search.
 */
export const RECORDING_TYPES = ["studio", "live", "ai"] as const
export type RecordingTypeId = (typeof RECORDING_TYPES)[number]
/** Ids an older draft, item or phone may still carry, and what they mean now (the API reads them the same way). */
export const LEGACY_RECORDING_TYPES: Readonly<Record<string, RecordingTypeId>> = { home: "studio" }
export const TEMPO_IDS = ["slow", "medium", "fast", "mix"] as const
export type TempoId = (typeof TEMPO_IDS)[number]
export const PERFORMANCES = ["solo", "group"] as const
export type PerformanceId = (typeof PERFORMANCES)[number]
export const AI_TYPE: RecordingTypeId = "ai"

/** What a form, a row or a stored recording says about these three. `undefined` and `null` both mean "not said". */
export type RecordingInfo = { recordingType?: string | null; tempo?: string | null; performance?: string | null; leadInstrument?: string | null; leadInstrumentOther?: string | null }
export type CleanInfo = { recordingType: RecordingTypeId | null; tempo: TempoId | null; performance: PerformanceId | null }
export const NO_INFO: CleanInfo = { recordingType: null, tempo: null, performance: null }

export function isRecordingType(value: unknown): value is RecordingTypeId {
  return typeof value === "string" && (RECORDING_TYPES as readonly string[]).includes(value)
}
/** A known id as it is now: the removed `home` is `studio`; anything that is not in the lists is null. */
export function normalizeRecordingType(value: unknown): RecordingTypeId | null {
  if (isRecordingType(value)) return value
  return typeof value === "string" ? (LEGACY_RECORDING_TYPES[value] ?? null) : null
}
export function isTempo(value: unknown): value is TempoId {
  return typeof value === "string" && (TEMPO_IDS as readonly string[]).includes(value)
}
export function isPerformance(value: unknown): value is PerformanceId {
  return typeof value === "string" && (PERFORMANCES as readonly string[]).includes(value)
}

/* ------------------------------------------------------------------ which kind carries what */

/** Does this kind ask how it was recorded? (Every kind but Baba's Audio Discourses.) */
export function kindHasRecordingType(kind: string | null | undefined): boolean {
  const k = normalizeKind(kind)
  return k === "kiirtan" || k === "dance_song" || k === "bhajan" || k === "spiritual_song" || k === "prabhat_samgiita" || k === "other_mantra"
}
/** Is the type of recording REQUIRED? A Kiirtan only. */
export function kindRequiresRecordingType(kind: string | null | undefined): boolean {
  return normalizeKind(kind) === "kiirtan"
}
/** May this kind be an AI recording? Every kind that says how it was recorded, a Bhajan too. */
export function kindAllowsAi(kind: string | null | undefined): boolean {
  return kindHasRecordingType(kind)
}
/** Is solo or group REQUIRED? A Kiirtan only. */
export function kindRequiresPerformance(kind: string | null | undefined): boolean {
  return normalizeKind(kind) === "kiirtan"
}
/**
 * Does the form show "I am the author of the recording"? Every kind that names a performer, except Prabhat Samgiita: it has
 * one author, so the tick is not shown for it and the server does not take it.
 */
export function kindHasByAuthor(kind: string | null | undefined): boolean {
  const k = normalizeKind(kind)
  return k !== "prabhat_samgiita" && k !== "baba_audio" && k !== "other_mantra"
}
/** Tempo is asked for Dance music and nothing else (Dada, 9 Nov 2026). */
export function kindHasTempo(kind: string | null | undefined): boolean {
  return normalizeKind(kind) === "dance_song"
}
export function kindHasPerformance(kind: string | null | undefined): boolean {
  const k = normalizeKind(kind)
  return k === "kiirtan" || k === "bhajan" || k === "other_mantra"
}
/** Does the kind have any of the three? (The form shows the block only then.) */
export function kindHasRecordingInfo(kind: string | null | undefined): boolean {
  return kindHasRecordingType(kind) || kindHasTempo(kind) || kindHasPerformance(kind)
}

/** The types of recording a kind offers, in the order the chips show them. */
export function recordingTypesFor(kind: string | null | undefined): RecordingTypeId[] {
  return RECORDING_TYPES.filter((id) => id !== AI_TYPE || kindAllowsAi(kind))
}

/* ------------------------------------------------------------------ cleaning */

/** The three values a kind keeps: a known id, and only for a kind that carries the field. Anything else is null. */
export function cleanRecordingInfo(kind: string | null | undefined, info: RecordingInfo): CleanInfo {
  const known = normalizeRecordingType(info.recordingType)
  const recordingType = kindHasRecordingType(kind) && known && (known !== AI_TYPE || kindAllowsAi(kind)) ? known : null
  return {
    recordingType,
    tempo: kindHasTempo(kind) && isTempo(info.tempo) ? info.tempo : null,
    performance: kindHasPerformance(kind) && isPerformance(info.performance) ? info.performance : null,
  }
}

/** Is solo or group still missing for this kind? */
export function performanceMissing(kind: string | null | undefined, performance: string | null | undefined): boolean {
  return kindRequiresPerformance(kind) && !isPerformance(performance)
}

/** Is the type of recording still missing for this kind? */
export function recordingTypeMissing(kind: string | null | undefined, recordingType: string | null | undefined): boolean {
  return kindRequiresRecordingType(kind) && !normalizeRecordingType(recordingType)
}

/** The row's own value when it has one (`undefined` = follows the form), else the form's. */
export function effectiveRecordingType(own: string | null | undefined, form: string | null | undefined, kind: string | null | undefined): RecordingTypeId | null {
  return cleanRecordingInfo(kind, { recordingType: own !== undefined ? own : form }).recordingType
}

/* ------------------------------------------------------------------ words */

export function recordingTypeLabel(id: RecordingTypeId): string {
  return t(`recinfo.type.${id}` as const)
}
export function tempoLabel(id: TempoId): string {
  return t(`recinfo.tempo.${id}` as const)
}
export function performanceLabel(id: PerformanceId): string {
  return t(`recinfo.performance.${id}` as const)
}

/** Is this recording made by AI? The listener is always told (docs/kiirtan-recording-info.md). */
export function isAiRecording(item: { recordingType?: string | null } | null | undefined): boolean {
  return !!item && item.recordingType === AI_TYPE
}

/** The tags a recording page shows: type of recording, tempo, solo or group, main instrument, in that order, only the ones that are known. */
export function infoTags(item: RecordingInfo): { id: string; label: string; ai: boolean }[] {
  const out: { id: string; label: string; ai: boolean }[] = []
  const type = normalizeRecordingType(item.recordingType)
  if (type) out.push({ id: `type-${type}`, label: recordingTypeLabel(type), ai: type === AI_TYPE })
  if (isTempo(item.tempo)) out.push({ id: `tempo-${item.tempo}`, label: tempoLabel(item.tempo), ai: false })
  if (isPerformance(item.performance)) out.push({ id: `performance-${item.performance}`, label: performanceLabel(item.performance), ai: false })
  // the main instrument: a listed one, or the word the person wrote (the server shows others that word once the team accepted it)
  if (isInstrumentId(item.leadInstrument)) out.push({ id: `instrument-${item.leadInstrument}`, label: instrumentLabel(item.leadInstrument), ai: false })
  else if (item.leadInstrument === OTHER_INSTRUMENT && item.leadInstrumentOther?.trim()) out.push({ id: "instrument-other", label: item.leadInstrumentOther.trim(), ai: false })
  return out
}

/* ------------------------------------------------------------------ the title in English */

/**
 * Letters of scripts that are not Latin: Greek, Cyrillic, Armenian, Hebrew, Arabic, the scripts of India and South-East
 * Asia, Georgian, Hangul, Kana and CJK. Latin letters with accents ("Bábá", "Śiva"), digits, spaces and punctuation
 * (including curly quotes and dashes) are not in it. Ranges, not `\p{Script}`, so it works on every JS engine.
 */
const NOT_LATIN = /[Ͱ-ϿЀ-ԯ԰-ᶿἀ-῿⺀-힯豈-﷿ﹰ-﻿]/

export function hasNonLatinLetters(text: string | null | undefined): boolean {
  return NOT_LATIN.test(text ?? "")
}

/** Must this title be in English? The title of a Kiirtan only; the other kinds keep any alphabet. */
export function titleMustBeEnglish(kind: string | null | undefined): boolean {
  return normalizeKind(kind) === "kiirtan"
}

/** Is the title in the wrong alphabet for its kind? (Soft rule: the form marks the title and does not send.) */
export function titleNeedsEnglish(kind: string | null | undefined, title: string | null | undefined): boolean {
  return titleMustBeEnglish(kind) && hasNonLatinLetters(title)
}
