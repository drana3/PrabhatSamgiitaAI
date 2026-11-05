/**
 * Reading what the answer endpoint sent back (spec 2.2, ADR 003: grounded, fail closed).
 *
 * /ai/explain streams plain text. It carries no structured sources, and its guards
 * (query guard, output guard, quota, missing song) reply with ordinary sentences.
 * This module sorts a finished reply into "a real answer" and "a notice", and lists
 * the songs an answer can honestly point to. A notice never gets a source row.
 */

import { dictionaries } from "@/locales"

export type AnswerKind = "answer" | "notice" | "quota" | "empty"

/** The only place the word AI appears (spec 4b). */
export const ASSISTANT_DISCLOSURE =
  "Written by AI from the song text and the discourse notes. It can be wrong."

export const NO_ANSWER_COPY =
  "There is no grounded answer for that. Try naming a song number, or open a song first."

const QUOTA_PATTERN = /\byou have reached today'?s (?:guest|signed-in) limit\b/i

const NOTICE_PATTERNS: RegExp[] = [
  /^Song not found\.?$/i,
  /^Streaming unavailable\.?$/i,
  /^I can help with Prabhat Samgiita songs/i,
  /^I can only share grounded guidance/i,
  /^I couldn[’']t find a grounded answer/i,
  /^The song companion is temporarily unavailable/i,
  /^Please ask something specific about Prabhat Samgiita/i,
  /^Prabhat Samgiita song numbers run from 1 to 5,?018/i,
  /^There is no grounded answer for that/i,
  /^That took too long/i,
  /^You appear to be offline/i,
]

/**
 * The app's own error and quota sentences (locales/assistantErrors.ts), in every language, so a
 * saved notice is still recognised as a notice after the language changes.
 */
let ownNotices: { notice: Set<string>; quota: Set<string> } | null = null
function ownNoticeKind(value: string): "notice" | "quota" | null {
  if (!ownNotices) {
    const notice = new Set<string>()
    const quota = new Set<string>()
    for (const dictionary of Object.values(dictionaries)) {
      for (const [key, text] of Object.entries(dictionary)) {
        if (!key.startsWith("assistant.error.")) continue
        ;(key.startsWith("assistant.error.quota") ? quota : notice).add(text)
      }
    }
    ownNotices = { notice, quota }
  }
  if (ownNotices.quota.has(value)) return "quota"
  if (ownNotices.notice.has(value)) return "notice"
  return null
}

export function classifyAnswer(text: string | null | undefined): AnswerKind {
  const value = (text ?? "").replace(/\s+/g, " ").trim()
  if (!value || value === "…") return "empty"
  const own = ownNoticeKind(value)
  if (own) return own
  const normalized = value.replace(/[’]/g, "'")
  if (QUOTA_PATTERN.test(normalized)) return "quota"
  if (NOTICE_PATTERNS.some((pattern) => pattern.test(value) || pattern.test(normalized))) {
    return "notice"
  }
  return "answer"
}

export type AnswerSource = {
  number: number
  /** "grounded" = the song the question was asked about; "mentioned" = named in the answer. */
  role: "grounded" | "mentioned"
}

const MAX_SOURCES = 4

const SONG_REF = /\b(?:PS|P\.S\.|song|prabhat\s+(?:samgiita|sangeet))[\s\-#.]*(?:no\.?\s*)?(\d{1,4})\b/gi

/** Song numbers an answer names, in order of first mention, 1..5018, without duplicates. */
export function extractSongRefs(text: string): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (const match of text.matchAll(SONG_REF)) {
    const number = Number(match[1])
    if (number < 1 || number > 5018 || seen.has(number)) continue
    seen.add(number)
    out.push(number)
  }
  return out
}

/**
 * Sources shown under an answer. Only a real answer has any; notices, quota
 * messages and empty replies return none. The grounded song always comes first.
 */
export function answerSources(input: {
  text: string
  groundedNumber: number | null
}): AnswerSource[] {
  if (classifyAnswer(input.text) !== "answer") return []
  const sources: AnswerSource[] = []
  if (input.groundedNumber) sources.push({ number: input.groundedNumber, role: "grounded" })
  for (const number of extractSongRefs(input.text)) {
    if (number === input.groundedNumber) continue
    sources.push({ number, role: "mentioned" })
  }
  return sources.slice(0, MAX_SOURCES)
}

/**
 * An answer with nothing to point to is shown with a caution line instead of a
 * source row (fail closed: never imply a source that is not there).
 */
export function needsNoSourceCaution(input: { text: string; groundedNumber: number | null }) {
  return classifyAnswer(input.text) === "answer" && answerSources(input).length === 0
}

export type TurnGrounding = { kind: "song"; number: number } | { kind: "catalogue" }

/**
 * What a turn is grounded on: a PS number named in the question wins, then the
 * song the sheet was opened on. With neither the backend still needs an anchor
 * song, so the turn is labelled "catalogue" and carries no grounded source.
 */
export function resolveTurnGrounding(
  explicitInPrompt: number | null,
  sheetSong: number | null,
): TurnGrounding {
  if (explicitInPrompt) return { kind: "song", number: explicitInPrompt }
  if (sheetSong && sheetSong >= 1 && sheetSong <= 5018) return { kind: "song", number: sheetSong }
  return { kind: "catalogue" }
}

export function groundingNumber(grounding: TurnGrounding): number | null {
  return grounding.kind === "song" ? grounding.number : null
}
