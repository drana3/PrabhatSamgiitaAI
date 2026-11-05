/**
 * The rules that decide whether a downloaded file is whole. Pure functions: the download service
 * (lib/offlineAudio.ts) feeds them what the file system and the server reported.
 *
 *   downloading --finished--> verifying --size matches--> done (moved into place)
 *                                      \--otherwise-----> failed (partial file removed or kept for resume)
 */

export type DownloadFailure =
  | "offline" // the connection dropped or there is none
  | "no-space" // the phone is full
  | "incomplete" // the file ended short of what the server announced
  | "http" // the server refused (404, 403, 5xx)
  | "stalled" // nothing arrived for a long time
  | "limit" // the listener's own storage limit is full
  | "unknown"

export class DownloadError extends Error {
  readonly code: DownloadFailure
  constructor(code: DownloadFailure, message?: string) {
    super(message ?? code)
    this.name = "DownloadError"
    this.code = code
  }
}

/** Room we keep free on top of the file itself, so the phone does not run out mid-song. */
export const SPARE_BYTES = 30 * 1024 * 1024

/** True when `free` bytes are enough to save `needed` bytes. Unknown free space never blocks a save. */
export function enoughSpace(free: number | null | undefined, needed: number | null | undefined): boolean {
  if (free == null || !Number.isFinite(free) || free < 0) return true
  const want = needed != null && needed > 0 ? needed : 0
  return free >= want + SPARE_BYTES
}

/** The Content-Length the server announced, from a headers object with any key casing. */
export function contentLengthFrom(headers: Record<string, string | string[] | undefined> | null | undefined): number | null {
  if (!headers) return null
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== "content-length") continue
    const raw = Array.isArray(value) ? value[0] : value
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return null
}

/**
 * Is the finished file whole? Returns null when it is, the reason when it is not.
 * `size` is what is on disk, `expected` what the progress events or the headers announced.
 */
export function verifyFinished(input: {
  status: number | null | undefined
  size: number | null | undefined
  expected: number | null | undefined
}): DownloadFailure | null {
  const status = input.status ?? 200
  if (status >= 400) return "http"
  const size = input.size
  // The file system could not tell us the size: nothing to compare, the status is all we have.
  if (size == null) return null
  if (size <= 0) return "incomplete"
  if (input.expected != null && input.expected > 0 && size !== input.expected) return "incomplete"
  return null
}

const NO_SPACE = /enospc|no space|not enough space|disk full|storage.*full|out of space/i
const NO_NETWORK = /network|offline|internet|connection|timed out|timeout|host|unreachable|econn|nsurlerror/i

/** Turns whatever the file system or network layer threw into one of our reasons. */
export function classifyDownloadError(error: unknown): DownloadFailure {
  if (error instanceof DownloadError) return error.code
  const message = error instanceof Error ? error.message : String(error ?? "")
  if (NO_SPACE.test(message)) return "no-space"
  if (NO_NETWORK.test(message)) return "offline"
  return "unknown"
}

/** Reasons after which the half-written file is worth keeping to continue from. */
export function keepsPartialFile(code: DownloadFailure): boolean {
  return code === "offline" || code === "stalled"
}

/**
 * Where to continue from. Android's downloader takes the byte count as its resume data;
 * iOS resume data is an opaque blob only a paused session has, so iOS starts over.
 */
export function resumeDataFor(platform: string, partialBytes: number | null | undefined): string | undefined {
  if (platform !== "android") return undefined
  return partialBytes != null && partialBytes > 0 ? String(Math.floor(partialBytes)) : undefined
}

/** The reason as a translation key, for the toast that follows a failed save. */
export function failureMessageKey(
  code: DownloadFailure,
): "dl.toast.offline" | "dl.toast.noSpace" | "dl.toast.limit" | "dl.toast.error" {
  if (code === "no-space") return "dl.toast.noSpace"
  if (code === "limit") return "dl.toast.limit"
  if (code === "offline" || code === "stalled") return "dl.toast.offline"
  return "dl.toast.error"
}

export const PART_SUFFIX = ".part"

export function partUriFor(finalUri: string): string {
  return `${finalUri}${PART_SUFFIX}`
}

/** A leftover half-written file older than this is dropped when the app starts. */
export const STALE_PART_MS = 3 * 24 * 60 * 60 * 1000

export function isStalePart(modificationTimeSeconds: number | null | undefined, nowMs: number): boolean {
  if (modificationTimeSeconds == null) return true
  return nowMs - modificationTimeSeconds * 1000 > STALE_PART_MS
}
