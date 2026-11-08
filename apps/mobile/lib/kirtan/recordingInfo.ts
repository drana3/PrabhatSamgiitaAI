import { t } from "@/lib/i18n"
import { normalizeKind } from "@/lib/kirtan/kind"

/**
 * How a recording was made and how it sounds: the TYPE OF RECORDING, the TEMPO and SOLO or GROUP. These are the words the
 * team already sorts the library by on anandamarga.org/music; the ids are the same ones. ONE list, kept in step with the API
 * (`apps/api/app/services/recording_info.py`; `__tests__/recordingInfo.test.ts` and `apps/api/tests/test_recording_info.py`
 * pin the two sides). To add a value: add its id here and there and a label in en, ru and es. The database stores the id
 * only, so no migration is needed. Rules and sources: docs/kiirtan-recording-info.md.
 *
 *  - type of recording: `studio`, `live` (at a programme), `home` (at home, on a phone or a voice recorder) and `ai` (made by an
 *    AI tool). REQUIRED for a Kiirtan; optional for Dance music, a Bhajan and a Spiritual song. `ai` is not taken as a Bhajan.
 *  - tempo: `slow`, `medium`, `fast`. Optional, Kiirtan and Dance music.
 *  - performance: `solo` or `group` (a group or a choir). Optional, Kiirtan and Bhajan.
 *
 * Also here: the title of a Kiirtan is written in English (Latin letters), so one alphabet serves the search.
 */
export const RECORDING_TYPES = ["studio", "live", "home", "ai"] as const
export type RecordingTypeId = (typeof RECORDING_TYPES)[number]
export const TEMPO_IDS = ["slow", "medium", "fast"] as const
export type TempoId = (typeof TEMPO_IDS)[number]
export const PERFORMANCES = ["solo", "group"] as const
export type PerformanceId = (typeof PERFORMANCES)[number]
export const AI_TYPE: RecordingTypeId = "ai"

/** What a form, a row or a stored recording says about these three. `undefined` and `null` both mean "not said". */
export type RecordingInfo = { recordingType?: string | null; tempo?: string | null; performance?: string | null }
export type CleanInfo = { recordingType: RecordingTypeId | null; tempo: TempoId | null; performance: PerformanceId | null }
export const NO_INFO: CleanInfo = { recordingType: null, tempo: null, performance: null }

export function isRecordingType(value: unknown): value is RecordingTypeId {
  return typeof value === "string" && (RECORDING_TYPES as readonly string[]).includes(value)
}
export function isTempo(value: unknown): value is TempoId {
  return typeof value === "string" && (TEMPO_IDS as readonly string[]).includes(value)
}
export function isPerformance(value: unknown): value is PerformanceId {
  return typeof value === "string" && (PERFORMANCES as readonly string[]).includes(value)
}

/* ------------------------------------------------------------------ which kind carries what */

/** Does this kind ask how it was recorded? (Kiirtan, Dance music, Bhajan, Spiritual song.) */
export function kindHasRecordingType(kind: string | null | undefined): boolean {
  const k = normalizeKind(kind)
  return k === "kiirtan" || k === "dance_song" || k === "bhajan" || k === "spiritual_song"
}
/** Is the type of recording REQUIRED? A Kiirtan only. */
export function kindRequiresRecordingType(kind: string | null | undefined): boolean {
  return normalizeKind(kind) === "kiirtan"
}
/** May this kind be an AI recording? Not a Bhajan. */
export function kindAllowsAi(kind: string | null | undefined): boolean {
  const k = normalizeKind(kind)
  return k === "kiirtan" || k === "dance_song" || k === "spiritual_song"
}
export function kindHasTempo(kind: string | null | undefined): boolean {
  const k = normalizeKind(kind)
  return k === "kiirtan" || k === "dance_song"
}
export function kindHasPerformance(kind: string | null | undefined): boolean {
  const k = normalizeKind(kind)
  return k === "kiirtan" || k === "bhajan"
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
  const recordingType = kindHasRecordingType(kind) && isRecordingType(info.recordingType) && (info.recordingType !== AI_TYPE || kindAllowsAi(kind)) ? info.recordingType : null
  return {
    recordingType,
    tempo: kindHasTempo(kind) && isTempo(info.tempo) ? info.tempo : null,
    performance: kindHasPerformance(kind) && isPerformance(info.performance) ? info.performance : null,
  }
}

/** Is the type of recording still missing for this kind? */
export function recordingTypeMissing(kind: string | null | undefined, recordingType: string | null | undefined): boolean {
  return kindRequiresRecordingType(kind) && !isRecordingType(recordingType)
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

/** The tags a recording page shows: type of recording, tempo, solo or group, in that order, only the ones that are known. */
export function infoTags(item: RecordingInfo): { id: string; label: string; ai: boolean }[] {
  const out: { id: string; label: string; ai: boolean }[] = []
  if (isRecordingType(item.recordingType)) out.push({ id: `type-${item.recordingType}`, label: recordingTypeLabel(item.recordingType), ai: item.recordingType === AI_TYPE })
  if (isTempo(item.tempo)) out.push({ id: `tempo-${item.tempo}`, label: tempoLabel(item.tempo), ai: false })
  if (isPerformance(item.performance)) out.push({ id: `performance-${item.performance}`, label: performanceLabel(item.performance), ai: false })
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
