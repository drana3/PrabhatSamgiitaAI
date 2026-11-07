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
const LINK_TOKEN = /(?:https?:\/\/|www\.)[^\s,;<>"')\]]*/gi
/** Well-known endings only, so "yes.No" or "end.Next" is not taken for an address; an e-mail address is not a link. Same list as the API. */
const BARE_TLDS = "com|org|net|edu|gov|info|biz|io|co|app|dev|xyz|online|site|link|shop|store|blog|club|live|tv|ly|uk|de|fr|ru|ua|pl|nl|ch|cz|se|jp|cn|br|au|nz|ai"
const BARE_LINK = new RegExp(`(?<![\\w@./-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${BARE_TLDS})(?![\\w@-])(?!\\.[a-z0-9])`, "gi")
/** Characters that draw nothing and only change how text reads: bidi overrides and isolates, direction marks, zero-width space, word joiner, byte-order mark, soft hyphen, tag characters (Unicode "format", minus the two joiners). */
const INVISIBLE =
  /[\u00AD\u0600-\u0605\u061C\u06DD\u070F\u08E2\u180E\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB\u{E0000}-\u{E007F}]/gu

/** A joiner is kept only next to a letter of an Indic script (U+0900 to U+0DFF) or an emoji: there it shapes the text. */
function joinerBelongs(chars: readonly string[], index: number): boolean {
  const meaningful = (position: number): boolean => {
    const char = chars[position]
    if (char === undefined) return false
    const code = char.codePointAt(0) ?? 0
    return (code >= 0x0900 && code <= 0x0dff) || code >= 0x1f000 || (code >= 0x2190 && code <= 0x2bff)
  }
  return meaningful(index - 1) || meaningful(index + 1)
}

/** The text without the invisible characters the server also drops (bidi overrides, zero-width marks). Indic and emoji joiners stay. */
export function stripInvisible(raw: string): string {
  const chars = Array.from(raw.replace(INVISIBLE, ""))
  return chars.filter((char, index) => (char === "\u200c" || char === "\u200d" ? joinerBelongs(chars, index) : true)).join("")
}

/** The text as the server will keep it: trimmed, invisible characters gone, spaces collapsed inside a line, at most one blank line in a row. */
export function cleanDraft(raw: string): string {
  const lines = stripInvisible(raw)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.split(/\s+/).filter(Boolean).join(" "))
  return lines.join("\n").trim().replace(/\n{3,}/g, "\n\n")
}

/** Links in a text: `https://...`, `www....` and bare addresses such as `example.com` (one each), as the server counts them. */
export function linkCount(text: string): number {
  const withScheme = (text.match(LINK) ?? []).length
  const bare = (text.replace(LINK_TOKEN, " ").match(BARE_LINK) ?? []).length
  return withScheme + bare
}

/** What "the same comment" means to the server: letters, marks and digits only, one case. Used by the in-memory preview. */
export function sameTextKey(text: string): string {
  return stripInvisible(text).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, "")
}

export function draftProblem(raw: string): CommentFailure | null {
  const text = cleanDraft(raw)
  if (!text) return "empty"
  if (text.length > COMMENT_MAX_LENGTH) return "tooLong"
  if (linkCount(text) > COMMENT_MAX_LINKS) return "links"
  return null
}

/**
 * What the composer says while the person types, so a shut Post button is never a mystery: only "links" (more than two),
 * the one reason that cannot be read off the screen. Too long is the counter's job, an empty field needs no sentence.
 */
export function liveNotice(raw: string): "links" | null {
  return draftProblem(raw) === "links" ? "links" : null
}

/** What the writer sees counted: characters that stay in the comment (invisible ones are dropped, so they are not counted). */
export function visibleLength(raw: string): number {
  return stripInvisible(raw).length
}

export function charactersLeft(raw: string): number {
  return COMMENT_MAX_LENGTH - visibleLength(raw)
}

export function showCounter(raw: string): boolean {
  return visibleLength(raw) >= COUNTER_FROM
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
