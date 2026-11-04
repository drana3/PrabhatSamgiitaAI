/**
 * YouTube link handling for kirtans. Pure functions, unit tested.
 * Only the link itself is understood; nothing here fetches video or audio data.
 */

export type YouTubeKind = "watch" | "short" | "shortlink" | "music" | "embed" | "live"

export type ParsedYouTube = {
  /** 11-character video id */
  id: string
  kind: YouTubeKind
  /** `t=` / `start=` of the link, in seconds, when it has one */
  startSeconds: number | null
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

/** The hosts a kirtan link may come from. A host is matched exactly, so `youtube.com.evil.com` fails. */
const WATCH_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"])
const SHORT_HOSTS = new Set(["youtu.be", "www.youtu.be"])

export function isVideoId(value: string): boolean {
  return VIDEO_ID.test(value)
}

/** `1h2m3s`, `90s`, `90` -> seconds. Anything else -> null. */
export function parseStartTime(raw: string | null | undefined): number | null {
  if (!raw) return null
  const text = raw.trim().toLowerCase()
  if (/^\d+$/.test(text)) return Number(text)
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text)
  if (!match || !(match[1] || match[2] || match[3])) return null
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)
}

function toUrl(input: string): URL | null {
  const text = input.trim()
  if (!text || /\s/.test(text)) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`
  try {
    const url = new URL(withScheme)
    return url.protocol === "https:" || url.protocol === "http:" ? url : null
  } catch {
    return null
  }
}

/**
 * Video id of a YouTube link: youtube.com/watch?v=, youtu.be/, /shorts/, /live/, /embed/ and
 * music.youtube.com/watch?v=. A playlist link with no video, a channel, any other site, or an id of
 * the wrong shape gives null.
 */
export function parseYouTubeUrl(input: string): ParsedYouTube | null {
  const url = toUrl(input)
  if (!url) return null
  const host = url.hostname.toLowerCase()
  const start = parseStartTime(url.searchParams.get("t") ?? url.searchParams.get("start"))
  const segments = url.pathname.split("/").filter(Boolean)

  if (SHORT_HOSTS.has(host)) {
    const id = segments[0]
    return id && isVideoId(id) ? { id, kind: "shortlink", startSeconds: start } : null
  }
  if (!WATCH_HOSTS.has(host)) return null

  if (segments[0] === "watch") {
    const id = url.searchParams.get("v")
    if (!id || !isVideoId(id)) return null
    return { id, kind: host === "music.youtube.com" ? "music" : "watch", startSeconds: start }
  }
  const kinds: Record<string, YouTubeKind> = { shorts: "short", live: "live", embed: "embed", v: "embed" }
  const kind = segments[0] ? kinds[segments[0]] : undefined
  const id = segments[1]
  if (kind && id && isVideoId(id)) return { id, kind, startSeconds: start }
  return null
}

/** The canonical link to the video on YouTube ("Open on YouTube", Share). */
export function youtubeWatchUrl(id: string, startSeconds?: number | null): string {
  return `https://www.youtube.com/watch?v=${id}${startSeconds ? `&t=${startSeconds}s` : ""}`
}

/** The official embedded player (IFrame player API enabled so the screen can follow its state). */
export function youtubeEmbedUrl(id: string, opts: { origin?: string; startSeconds?: number | null; autoplay?: boolean } = {}): string {
  const params = new URLSearchParams({ enablejsapi: "1", playsinline: "1", rel: "0" })
  if (opts.autoplay) params.set("autoplay", "1")
  if (opts.startSeconds) params.set("start", String(opts.startSeconds))
  if (opts.origin) params.set("origin", opts.origin)
  return `https://www.youtube.com/embed/${id}?${params.toString()}`
}

/** The public oEmbed endpoint: no API key. The link is sent in its canonical form. */
export function oembedEndpoint(id: string): string {
  return `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeWatchUrl(id))}&format=json`
}
