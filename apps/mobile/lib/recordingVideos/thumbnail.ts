import { parseVideoUrl } from "./rules"
import type { VideoProvider } from "./types"

/**
 * The picture of a video link (docs/kiirtan-video.md, "Previews"). Pure and tested; the screens draw it with
 * components/video/VideoThumb.tsx.
 *
 * A picture address is NEVER typed text and never a download of the video. It is one of:
 *  1. the address the server kept for the link (`thumbnailUrl`: the site's own picture, checked on the server),
 *  2. an address built from the provider and the video's id (YouTube `mqdefault`, Internet Archive `services/img`).
 * Both go through `safeThumbnailUrl` here as well (https only, no user name or password, no odd port, the image
 * host of that provider compared whole), so a row from an older or a hostile server cannot make the phone load
 * from anywhere else. Vimeo has no address by id: its picture exists only when the server found it.
 *
 * Why previews used to vanish (see the report of 9 November): a picture that failed once stayed blank for good
 * (no `onError`, no retry), YouTube's `maxresdefault` often does not exist and answers with a grey 120x90
 * stand-in that still "loads", Vimeo and Archive links never had a picture, and the broadcast tile took its
 * picture from one look at the moment of creation.
 */

/** The image hosts per provider, compared whole (never as text: `i.ytimg.com.evil.com` and `i.ytimg.com@evil.com` fail). */
export const THUMBNAIL_HOSTS: Record<VideoProvider, readonly string[]> = {
  youtube: ["i.ytimg.com"],
  vimeo: ["i.vimeocdn.com"],
  archive: ["archive.org"],
}

/** The 16:9 shape every preview has, so nothing jumps when the picture arrives. */
export const THUMBNAIL_ASPECT = 16 / 9

/** A picture this small is the site's grey "no picture here" stand-in (YouTube's is 120x90), not a picture. */
export const STUB_MAX_WIDTH = 120
export const STUB_MAX_HEIGHT = 90

/** Waits before the 1st, 2nd and 3rd automatic try again after a failure, in ms. Then it stops and waits for a tap. */
export const RETRY_DELAYS_MS: readonly number[] = [1500, 4000, 9000]

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const ARCHIVE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,99}$/
const PICTURE_PATH = /^\/[A-Za-z0-9_./-]{1,200}$/

/** A picture address that may be loaded for this provider, or null. Returned without its query and fragment. */
export function safeThumbnailUrl(provider: VideoProvider, raw: unknown): string | null {
  if (typeof raw !== "string" || !raw || raw.length > 300 || raw.includes("..")) return null
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null
  if (parsed.port && parsed.port !== "443") return null
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "")
  if (!THUMBNAIL_HOSTS[provider].includes(host)) return null
  if (!PICTURE_PATH.test(parsed.pathname) || parsed.pathname.includes("..")) return null
  return `https://${host}${parsed.pathname}`
}

/** The address built from the provider and the video's id alone (no request for it), or null when there is none (Vimeo). */
export function thumbnailById(provider: VideoProvider, id: string): string | null {
  if (provider === "youtube" && YOUTUBE_ID.test(id)) return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
  if (provider === "archive" && ARCHIVE_ID.test(id)) return `https://archive.org/services/img/${encodeURIComponent(id)}`
  return null
}

export type ThumbnailSubject = { provider: VideoProvider; url: string; thumbnailUrl?: string | null }

/**
 * Every address to try for one link, best first, without repeats. The kept picture of the server first (it is the
 * site's own and the only one Vimeo has), then the one built from the id. The id is read again from the stored
 * address with the form's own parser, never taken on trust.
 */
export function thumbnailSources(subject: ThumbnailSubject): string[] {
  const out: string[] = []
  const kept = safeThumbnailUrl(subject.provider, subject.thumbnailUrl)
  if (kept) out.push(kept)
  const parsed = parseVideoUrl(subject.url)
  if (parsed.ok && parsed.provider === subject.provider) {
    const byId = thumbnailById(parsed.provider, parsed.id)
    if (byId && !out.includes(byId)) out.push(byId)
  }
  return out
}

/** The provider and the rebuilt address of a plain video link (a curated PS video), or null when it is not one of the three sites. */
export function subjectFromUrl(raw: string, kept?: string | null): ThumbnailSubject | null {
  const parsed = parseVideoUrl(raw)
  return parsed.ok ? { provider: parsed.provider, url: parsed.url, thumbnailUrl: kept ?? null } : null
}

/** The same for a link that is only being typed (the upload form): what the phone itself can build, nothing fetched. */
export function thumbnailSourcesForText(raw: string, kept?: string | null): string[] {
  const parsed = parseVideoUrl(raw)
  return parsed.ok ? thumbnailSources({ provider: parsed.provider, url: parsed.url, thumbnailUrl: kept ?? null }) : []
}

/** True when a loaded picture is really the site's stand-in: the picture "loaded" but is tiny. Unknown size counts as real. */
export function isStubPicture(width: number | null | undefined, height: number | null | undefined): boolean {
  if (!width || !height) return false
  return width <= STUB_MAX_WIDTH && height <= STUB_MAX_HEIGHT
}

/** The wait before the next automatic try, or null when the tries are used up. `attempt` is how many failures there were (1 = the first). */
export function retryDelay(attempt: number): number | null {
  if (attempt < 1) return null
  return RETRY_DELAYS_MS[attempt - 1] ?? null
}

/**
 * What the loader remembers between screens (one list per run of the app): a picture that loaded is trusted at once,
 * one that failed is not asked for again for a while so a list of many rows does not hammer a dead address. The
 * disk cache itself is expo-image's. Pure: the clock comes in.
 */
export const BAD_SOURCE_FOR_MS = 60_000
const MEMORY_MAX = 300

export type SourceMemory = { good: Set<string>; bad: Map<string, number> }

export function createSourceMemory(): SourceMemory {
  return { good: new Set(), bad: new Map() }
}

export function rememberGood(memory: SourceMemory, src: string): void {
  memory.bad.delete(src)
  if (memory.good.size >= MEMORY_MAX) memory.good.delete(memory.good.values().next().value as string)
  memory.good.add(src)
}

export function rememberBad(memory: SourceMemory, src: string, now: number): void {
  memory.good.delete(src)
  if (memory.bad.size >= MEMORY_MAX) memory.bad.delete(memory.bad.keys().next().value as string)
  memory.bad.set(src, now)
}

export function isKnownBad(memory: SourceMemory, src: string, now: number): boolean {
  const at = memory.bad.get(src)
  if (at === undefined) return false
  if (now - at >= BAD_SOURCE_FOR_MS) {
    memory.bad.delete(src)
    return false
  }
  return true
}

/** The addresses worth trying now: a source known to be bad is skipped, unless every one is (then all are tried, so something shows). */
export function sourcesToTry(memory: SourceMemory, sources: readonly string[], now: number): string[] {
  const live = sources.filter((s) => !isKnownBad(memory, s, now))
  return live.length ? live : [...sources]
}

/** The mark drawn on the placeholder: the site's name. */
export function providerMark(provider: VideoProvider): string {
  return provider === "youtube" ? "YouTube" : provider === "vimeo" ? "Vimeo" : "Internet Archive"
}

/**
 * The loader's small state machine (the component only wires events to it).
 *  - `loading`: the source at `index` is being fetched.
 *  - `ready`: it showed.
 *  - `waiting`: every source failed; the next automatic try comes after `retryDelay(attempt)`.
 *  - `failed`: the automatic tries are used up; the placeholder stays and "try again" is offered.
 * A failed source moves on to the next one at once; only when all of them failed does a try count.
 */
export type ThumbPhase = "loading" | "ready" | "waiting" | "failed"
export type ThumbState = { index: number; attempt: number; phase: ThumbPhase }
export type ThumbEvent = "loaded" | "failed" | "retry" | "again"

export const thumbStart: ThumbState = { index: 0, attempt: 0, phase: "loading" }

export function thumbNext(state: ThumbState, event: ThumbEvent, total: number): ThumbState {
  if (total <= 0) return { ...state, phase: "failed" }
  switch (event) {
    case "loaded":
      return { ...state, phase: "ready" }
    case "failed": {
      if (state.phase === "ready") return state
      if (state.index + 1 < total) return { ...state, index: state.index + 1, phase: "loading" }
      const attempt = state.attempt + 1
      return retryDelay(attempt) === null ? { index: state.index, attempt, phase: "failed" } : { index: state.index, attempt, phase: "waiting" }
    }
    case "retry": // the timer ran out (or the app came back to the front)
      return state.phase === "waiting" || state.phase === "failed" ? { index: 0, attempt: state.attempt, phase: "loading" } : state
    case "again": // the person asked
      return { index: 0, attempt: 0, phase: "loading" }
  }
}
