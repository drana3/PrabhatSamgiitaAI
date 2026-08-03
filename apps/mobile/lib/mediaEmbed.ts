/**
 * Keep media playback inside the app — never send users to YouTube/search pages.
 */

const YOUTUBE_ID =
  /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i

export function extractYoutubeId(value: string | null | undefined): string | null {
  if (!value) return null
  const match = YOUTUBE_ID.exec(value)
  return match?.[1] ?? null
}

/** Trusted HTTPS origin so YouTube accepts the WebView Referer (avoids Error 153). */
export const YOUTUBE_EMBED_REFERER = "https://prabhatasamgiita.net/"

/** In-app embed URL suitable for WebView / iframe. */
export function toInAppVideoEmbedUrl(urlOrEmbed: string | null | undefined): string | null {
  if (!urlOrEmbed?.trim()) return null
  const trimmed = urlOrEmbed.trim()
  if (/youtube\.com\/results/i.test(trimmed)) return null

  const id = extractYoutubeId(trimmed)
  if (id) {
    // youtube.com (not nocookie) + origin helps WKWebView avoid Error 153.
    const origin = encodeURIComponent("https://prabhatasamgiita.net")
    return `https://www.youtube.com/embed/${id}?playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=${origin}`
  }

  // Direct video file (mp4 etc.) can be loaded in WebView or expo-av Video
  if (/\.(mp4|m4v|webm|mov)(\?|$)/i.test(trimmed) || trimmed.includes("/embed/")) {
    return trimmed
  }

  return null
}

export function isExternalMediaRedirect(url: string | null | undefined): boolean {
  if (!url) return true
  return /youtube\.com\/results|youtube\.com\/watch|youtu\.be\//i.test(url) && !/\/embed\//i.test(url)
}

type MediaLike = {
  kind: string
  provider: string
  title: string
  url: string
  embed_url?: string | null
  verification_status: string
}

export function pickPreferredAudioUrl(media: MediaLike[]): string | null {
  const audios = media.filter((item) => item.kind === "audio" || item.provider === "direct_audio")
  const preferred =
    audios.find((item) => item.verification_status.includes("verified") && item.provider === "official") ||
    audios.find((item) => item.verification_status.includes("verified")) ||
    audios[0]
  return preferred?.url?.trim() || preferred?.embed_url?.trim() || null
}

export function mediaVideosToEmbeds(
  media: MediaLike[],
  fallbackScenic: string,
  songNumber: number,
): Array<{ id: string; title: string; url: string; embedUrl: string; thumbnailUrl: string }> {
  const videos = media.filter((item) => item.kind === "video" || item.provider === "youtube")
  const mapped = videos
    .map((item, index) => {
      const embedUrl = toInAppVideoEmbedUrl(item.embed_url || item.url)
      if (!embedUrl) return null
      return {
        id: `video-${songNumber}-${index}`,
        title: item.title || `Watch PS ${songNumber}`,
        url: item.url,
        embedUrl,
        thumbnailUrl: fallbackScenic,
      }
    })
    .filter(Boolean) as Array<{
    id: string
    title: string
    url: string
    embedUrl: string
    thumbnailUrl: string
  }>
  return mapped
}
