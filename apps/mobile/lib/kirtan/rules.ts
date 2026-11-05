import { t } from "@/lib/i18n"
import type { UploadFailure } from "@/lib/kirtan/types"

/**
 * The rules around publishing a Kiirtan or a Bhajan (docs/kiirtan-publishing.md): the content rules page, the report
 * reasons, the size and format checks of the audio file, and the plain sentence for every way an upload can fail.
 * Pure: no React, no network.
 */

/**
 * Version of the content rules a person accepts before the first upload. It must equal the API's
 * `RECORDING_TERMS_VERSION` (the server refuses a different one and asks the person to read the rules again).
 * Change both when the rules change in substance.
 */
export const RULES_VERSION = "2026-11"

/** Where complaints and appeals go. Shown on the rules page and in a removal notice. */
export const CONTACT_ROUTE = "/feedback"

/* ------------------------------------------------------------------ the rules page */

export const RULE_SECTIONS = ["what", "copyright", "respect", "after", "appeal"] as const
export type RuleSectionId = (typeof RULE_SECTIONS)[number]

/** The sections of the page, in order, with their words in the app language. */
export function ruleSections(): { id: RuleSectionId; title: string; body: string }[] {
  return RULE_SECTIONS.map((id) => ({ id, title: t(`ugc.rules.${id}.title`), body: t(`ugc.rules.${id}.body`) }))
}

/* ------------------------------------------------------------------ report */

/** The reasons a person can give when reporting a recording. The ids are the API's. */
export const REPORT_REASONS = ["copyright", "offensive", "wrong_info", "other"] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export function reportReasonLabel(reason: ReportReason): string {
  return t(`ugc.report.reason.${reason}`)
}

export function reportReasonHint(reason: ReportReason): string {
  return t(`ugc.report.hint.${reason}`)
}

export const REPORT_COMMENT_MAX = 500

/* ------------------------------------------------------------------ the audio file */

/** Same limit as the API's `RECORDING_MAX_BYTES` (60 MB). The server checks it again. */
export const MAX_UPLOAD_BYTES = 60 * 1024 * 1024

const CONTENT_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  webm: "audio/webm",
}

export const AUDIO_EXTENSIONS: readonly string[] = Object.keys(CONTENT_TYPES)

function extensionOf(name: string): string {
  const match = /\.([a-z0-9]{2,5})$/i.exec(name.trim())
  return match ? match[1].toLowerCase() : ""
}

/** The content type to send for a picked file: by its extension, else by what the picker said, else null (not accepted). */
export function audioContentType(name: string, mime?: string | null): string | null {
  const byName = CONTENT_TYPES[extensionOf(name)]
  if (byName) return byName
  const declared = (mime ?? "").split(";")[0].trim().toLowerCase()
  return Object.values(CONTENT_TYPES).includes(declared) || declared === "audio/x-m4a" || declared === "audio/x-wav" ? declared : null
}

export type FileProblem = "format" | "size"

/** Is this picked file one the server will take? `size` may be null when the picker does not know it (the server checks). */
export function validateAudioFile(file: { name: string; size: number | null; type?: string | null }): FileProblem | null {
  if (!audioContentType(file.name, file.type)) return "format"
  if (file.size != null && file.size > MAX_UPLOAD_BYTES) return "size"
  return null
}

export function fileProblemText(problem: FileProblem): string {
  return problem === "format" ? t("ugc.form.error.format") : t("ugc.form.error.size", { mb: Math.round(MAX_UPLOAD_BYTES / (1024 * 1024)) })
}

/* ------------------------------------------------------------------ upload errors */

/** One plain sentence for a failed upload. */
export function uploadErrorText(failure: UploadFailure): string {
  switch (failure.code) {
    case "network":
      return t("ugc.err.network")
    case "signin":
      return t("ugc.err.signin")
    case "format":
      return t("ugc.form.error.format")
    case "size":
      return t("ugc.form.error.size", { mb: Math.round(MAX_UPLOAD_BYTES / (1024 * 1024)) })
    case "duplicate":
      return t("ugc.err.duplicate")
    case "removedDuplicate":
      return t("ugc.err.removedDuplicate")
    case "rules":
      return t("ugc.err.rules")
    case "gone":
      return t("ugc.err.gone")
    default:
      return failure.message?.trim() || t("ugc.err.server")
  }
}

/* ------------------------------------------------------------------ agreeing to the rules */

/** What is kept on the phone about "I agree to the content rules" (stores/contentRulesStore). */
export type RulesAcceptance = {
  /** ISO time the person ticked the box; null when never */
  acceptedAt: string | null
  /** the RULES_VERSION they accepted */
  version: string | null
}

/** True while the stored acceptance is for the rules that apply today. After a change of the rules the box shows again. */
export function isRulesAccepted(record: RulesAcceptance | null | undefined): boolean {
  if (!record || !record.acceptedAt || Number.isNaN(Date.parse(record.acceptedAt))) return false
  return record.version === RULES_VERSION
}
