import type { CommentFailure, CommentReportReason } from "./types"

/** The same limits as the API (apps/api/app/models/song_comments.py). */
export const COMMENT_MAX_LENGTH = 2000
export const COMMENT_MAX_LINKS = 2
export const COMMENT_PAGE_SIZE = 20
/** The reasons for a report. The ids are the API's. */
export const COMMENT_REPORT_REASONS: readonly CommentReportReason[] = ["offensive", "spam", "private", "other"]
/** Show the counter only when the writer is close to the limit. */
export const COUNTER_FROM = 1800

const LINK = /(?:https?:\/\/|www\.)/gi

/** The text as the server will keep it: trimmed, spaces collapsed inside a line, at most one blank line in a row. */
export function cleanDraft(raw: string): string {
  const lines = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.split(/\s+/).filter(Boolean).join(" "))
  return lines.join("\n").trim().replace(/\n{3,}/g, "\n\n")
}

export function linkCount(text: string): number {
  return (text.match(LINK) ?? []).length
}

/** Why this draft cannot be posted yet, or null when it can. `empty` is not an error to show, only a disabled button. */
export function draftProblem(raw: string): CommentFailure | null {
  const text = cleanDraft(raw)
  if (!text) return "empty"
  if (text.length > COMMENT_MAX_LENGTH) return "tooLong"
  if (linkCount(text) > COMMENT_MAX_LINKS) return "links"
  return null
}

export function charactersLeft(raw: string): number {
  return COMMENT_MAX_LENGTH - raw.length
}

export function showCounter(raw: string): boolean {
  return raw.length >= COUNTER_FROM
}

export type Elapsed =
  | { kind: "now" }
  | { kind: "minutes"; count: number }
  | { kind: "hours"; count: number }
  | { kind: "days"; count: number }
  | { kind: "date" }

/** How long ago, in one unit; a week or more is shown as a date. A clock slightly ahead of the server counts as "just now". */
export function elapsed(createdAt: string | number | Date, now: number = Date.now()): Elapsed {
  const then = new Date(createdAt).getTime()
  if (!Number.isFinite(then)) return { kind: "date" }
  const seconds = Math.max(0, Math.floor((now - then) / 1000))
  if (seconds < 60) return { kind: "now" }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return { kind: "minutes", count: minutes }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { kind: "hours", count: hours }
  const days = Math.floor(hours / 24)
  if (days < 7) return { kind: "days", count: days }
  return { kind: "date" }
}

/** The first letter to put in an avatar square, in upper case. Never an empty string. */
export function initialOf(name: string): string {
  const letter = Array.from(name.trim())[0]
  return letter ? letter.toLocaleUpperCase() : "?"
}

/** Whether a song number can have comments (the API takes 1 to 5018). */
export function commentableSong(number: unknown): number | null {
  return typeof number === "number" && Number.isInteger(number) && number >= 1 && number <= 5018 ? number : null
}

/** What can be posted and as whom, for the line under the checkbox. */
export type PostingAs = { kind: "named"; name: string } | { kind: "anonymous" }

export function postingAs(anonymous: boolean, name: string): PostingAs {
  return anonymous ? { kind: "anonymous" } : { kind: "named", name: name.trim() || "" }
}

/** Who may write: a signed-in member whose build can prove it to the server. The preview always may. */
export type PostingAccess = "ok" | "signin" | "unavailable"

export function postingAccess(input: { preview: boolean; signedIn: boolean; canProve: boolean }): PostingAccess {
  if (input.preview) return "ok"
  if (!input.signedIn) return "signin"
  return input.canProve ? "ok" : "unavailable"
}
