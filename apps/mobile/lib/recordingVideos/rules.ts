import { linkCount, stripInvisible } from "@/lib/songComments/rules"

import type { VideoFailure, VideoProvider, VideoReportReason } from "./types"

/** The same limits as the API (apps/api/app/services/video_links.py). */
export const VIDEO_TITLE_MAX = 80
export const VIDEO_URL_MAX = 300
export const MAX_PER_TARGET = 12
export const MAX_PER_MEMBER_PER_TARGET = 3
export const VIDEO_REPORT_REASONS: readonly VideoReportReason[] = ["broken", "not_about_this", "offensive", "spam", "other"]
/** The sites that are accepted, in the order the form names them. The API has the same list; adding one means one entry there and one here. */
export const VIDEO_PROVIDERS: readonly VideoProvider[] = ["youtube", "vimeo", "archive"]

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"])
const YOUTUBE_NOCOOKIE = "www.youtube-nocookie.com"
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"])
const ARCHIVE_HOSTS = new Set(["archive.org", "www.archive.org"])
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const VIMEO_PATH = /^\/(?:(?:channels\/[A-Za-z0-9_-]+|groups\/[A-Za-z0-9_-]+\/videos|video|album\/\d+\/video)\/)?(\d{6,12})(?:\/([0-9a-f]{8,12}))?\/?$/
const ARCHIVE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,99}$/

export type ParsedVideo = { provider: VideoProvider; id: string; url: string }
export type ParseResult = ({ ok: true } & ParsedVideo) | { ok: false; failure: "badLink" | "notHttps" | "provider" }

const BAD = { ok: false, failure: "badLink" } as const

function youtubeId(host: string, path: string, query: string): string | null {
  const segments = path.split("/").filter(Boolean)
  let candidate = ""
  if (host === "youtu.be") candidate = segments.length === 1 ? (segments[0] as string) : ""
  else if (segments[0] === "watch" && segments.length === 1) {
    for (const pair of query.split("&")) {
      const [name, value = ""] = pair.split("=")
      if (name === "v") {
        try {
          candidate = decodeURIComponent(value)
        } catch {
          candidate = ""
        }
        break
      }
    }
  } else if (segments.length === 2 && ["embed", "shorts", "live", "v"].includes(segments[0] as string)) candidate = segments[1] as string
  return YOUTUBE_ID.test(candidate) ? candidate : null
}

/**
 * A pasted link as the server reads it (same rules, same result): https only (a link typed without a scheme is read as
 * https), no user name, no odd port, no non-ASCII host, a single video on an allowed site. Tracking parameters, the
 * fragment and the time stamp are dropped and the address is rebuilt from the site and the video's id. Never fetched.
 * Used to tell the person at once what is wrong; the server still decides.
 */
export function parseVideoUrl(raw: string): ParseResult {
  let text = stripInvisible(raw ?? "").trim()
  if (!text || text.length > VIDEO_URL_MAX + 200) return BAD
  // eslint-disable-next-line no-control-regex
  if (/\s/.test(text) || /[\u0000-\u001f\u007f]/.test(text)) return BAD
  if (!text.includes("://")) {
    if (/^(?:javascript|data|file|mailto|intent):/i.test(text)) return BAD
    text = `https://${text.replace(/^\/+/, "")}`
  }
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?(?:#.*)?$/.exec(text)
  if (!m) return BAD
  const [, scheme = "", authority = "", pathRaw = "", query = ""] = m
  if (scheme.toLowerCase() !== "https") return { ok: false, failure: "notHttps" }
  if (authority.includes("@")) return BAD
  const hostPort = /^(\[[^\]]*\]|[^:]*)(?::(\d*))?$/.exec(authority)
  if (!hostPort) return BAD
  const port = hostPort[2]
  if (port && port !== "443") return BAD
  const host = (hostPort[1] ?? "").toLowerCase().replace(/\.+$/, "")
  // eslint-disable-next-line no-control-regex
  if (!host || !/^[\u0000-\u007f]*$/.test(host)) return BAD
  const path = pathRaw || "/"

  if (YOUTUBE_HOSTS.has(host) || host === YOUTUBE_NOCOOKIE) {
    const id = youtubeId(host, path, query)
    return id ? { ok: true, provider: "youtube", id, url: `https://www.youtube.com/watch?v=${id}` } : BAD
  }
  if (VIMEO_HOSTS.has(host)) {
    const v = VIMEO_PATH.exec(path)
    if (!v) return BAD
    return { ok: true, provider: "vimeo", id: v[1] as string, url: `https://vimeo.com/${v[1]}${v[2] ? `/${v[2]}` : ""}` }
  }
  if (ARCHIVE_HOSTS.has(host)) {
    const segments = path.split("/").filter(Boolean)
    if (segments.length < 2 || segments[0] !== "details" || !ARCHIVE_ID.test(segments[1] as string)) return BAD
    return { ok: true, provider: "archive", id: segments[1] as string, url: `https://archive.org/details/${segments[1]}` }
  }
  return { ok: false, failure: "provider" }
}

/** The title as the server keeps it: invisible characters gone, spaces collapsed; or the problem. An empty title is no title. */
export function cleanVideoTitle(raw: string): { ok: true; title: string | null } | { ok: false; failure: "titleTooLong" | "titleLink" } {
  const title = stripInvisible(raw ?? "").split(/\s+/).filter(Boolean).join(" ")
  if (!title) return { ok: true, title: null }
  if (Array.from(title).length > VIDEO_TITLE_MAX) return { ok: false, failure: "titleTooLong" }
  if (linkCount(title) > 0) return { ok: false, failure: "titleLink" }
  return { ok: true, title }
}

/** What stops a draft from being sent, link first; null when it can go. */
export function videoDraftProblem(draft: { url: string; title: string }): VideoFailure | null {
  const link = parseVideoUrl(draft.url)
  if (!link.ok) return link.failure
  const title = cleanVideoTitle(draft.title)
  return title.ok ? null : title.failure
}

/** "youtube.com" for a YouTube link: the host the person lands on, shown beside each link. */
export function providerHost(provider: VideoProvider): string {
  return provider === "youtube" ? "youtube.com" : provider === "vimeo" ? "vimeo.com" : "archive.org"
}

/** The one place a link may be opened: https and a host of the list. Anything else is never opened (a stored row is not trusted either). */
export function safeToOpen(url: string): boolean {
  const parsed = parseVideoUrl(url)
  return parsed.ok && parsed.url === url
}
