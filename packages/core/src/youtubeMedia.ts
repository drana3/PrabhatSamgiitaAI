const YOUTUBE_ID =
  /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i

const STANDALONE_ID = /^[A-Za-z0-9_-]{6,}$/

export type YoutubeThumbnailQuality = "default" | "mq" | "hq" | "sd" | "maxres"

const THUMB_SUFFIX: Record<YoutubeThumbnailQuality, string> = {
  default: "default",
  mq: "mqdefault",
  hq: "hqdefault",
  sd: "sddefault",
  maxres: "maxresdefault",
}

export function extractYoutubeVideoId(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const match = YOUTUBE_ID.exec(trimmed)
  if (match?.[1]) return match[1]
  if (STANDALONE_ID.test(trimmed)) return trimmed
  return null
}

export function youtubeThumbnailUrl(
  videoIdOrUrl: string | null | undefined,
  quality: YoutubeThumbnailQuality = "hq",
): string | null {
  const id = extractYoutubeVideoId(videoIdOrUrl)
  if (!id) return null
  return `https://i.ytimg.com/vi/${id}/${THUMB_SUFFIX[quality]}.jpg`
}

type VideoThumbSource = {
  url?: string | null
  embed_url?: string | null
  external_id?: string | null
  metadata_json?: Record<string, unknown> | null
}

/** Prefer catalog external_id, then embed URL, then watch URL. */
export function resolveYoutubeVideoId(source: VideoThumbSource): string | null {
  const meta = source.metadata_json
  const external =
    (typeof source.external_id === "string" && source.external_id.trim()) ||
    (meta && typeof meta.external_id === "string" && meta.external_id.trim()) ||
    null
  if (external) return extractYoutubeVideoId(external)
  return extractYoutubeVideoId(source.embed_url) ?? extractYoutubeVideoId(source.url)
}

export function resolveYoutubeVideoThumbnail(
  source: VideoThumbSource,
  fallback: string,
  quality: YoutubeThumbnailQuality = "hq",
): string {
  const id = resolveYoutubeVideoId(source)
  if (!id) return fallback
  return youtubeThumbnailUrl(id, quality) || fallback
}