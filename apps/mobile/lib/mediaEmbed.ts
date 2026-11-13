/**
 * Keep media playback inside the app — never send users to YouTube/search pages.
 */

import { compareAudioQuality, unwrapArchiveAudioUrl } from "@prabhat/core"

const YOUTUBE_ID =
  /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i

export function extractYoutubeId(value: string | null | undefined): string | null {
  if (!value) return null
  const match = YOUTUBE_ID.exec(value)
  return match?.[1] ?? null
}

/**
 * Referer / base URL for YouTube embeds inside WebViews (Error 153 when it is missing).
 * YouTube's embedded-player rules ask for an HTTPS URL whose domain is the app's registered id
 * (reverse-DNS bundle / package id), stable across versions.
 */
export const YOUTUBE_EMBED_REFERER = "https://net.prabhatasamgiita.ai/"

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * WebView source for a YouTube embed: a tiny HTML page with the iframe, loaded with a base URL so the
 * embed gets a real HTTPS Referer (WebView sends none for a bare uri). Shared by the song video card
 * and the live broadcast embed.
 */
export function youtubeEmbedWebSource(embedUrl: string): { html: string; baseUrl: string } {
  const joiner = embedUrl.includes("?") ? "&" : "?"
  const src = `${embedUrl}${joiner}widget_referrer=${encodeURIComponent(YOUTUBE_EMBED_REFERER)}`
  const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<meta name="referrer" content="strict-origin-when-cross-origin"/>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%}</style>
</head><body>
<iframe
  src="${escapeHtmlAttribute(src)}"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
  allowfullscreen
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>
</body></html>`
  return { html, baseUrl: YOUTUBE_EMBED_REFERER }
}

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
  performer?: string | null
  is_latest?: boolean
  loudness_lufs?: number | null
  true_peak_db?: number | null
}

export type PlayableAudio = {
  title: string
  url: string
  provider: string
  /** Who sang it, when the catalogue says (the colleagues' recordings); absent for the archive's own files. */
  performer?: string
  /** The API marks exactly one audio file per song as the best (`is_latest`). Absent when it does not. */
  isLatest?: boolean
  /** Measured loudness of this file (volume leveling); absent when the server has not measured it. */
  loudnessLufs?: number
  truePeakDb?: number
}

function audioStreamUrl(item: MediaLike): string | null {
  const raw = item.url?.trim() || item.embed_url?.trim() || ""
  if (!raw) return null
  const url = unwrapArchiveAudioUrl(raw)
  if (/youtube\.com\/results|youtube\.com\/watch|youtu\.be\//i.test(url)) return null
  return url
}

/** Direct audio streams, preferred recording first. YouTube stays on Watch. */
export function listPlayableAudio(media: MediaLike[]): PlayableAudio[] {
  const ranked = media
    .filter((item) => item.kind === "audio" || item.provider === "direct_audio")
    .slice()
    .sort(compareAudioQuality)
  const seen = new Set<string>()
  const items: PlayableAudio[] = []
  for (const item of ranked) {
    const url = audioStreamUrl(item)
    if (!url || seen.has(url)) continue
    seen.add(url)
    items.push({
      title: item.title?.trim() || "Recording",
      url,
      provider: item.provider,
      ...(item.performer?.trim() ? { performer: item.performer.trim() } : {}),
      ...(item.is_latest ? { isLatest: true } : {}),
      ...(typeof item.loudness_lufs === "number" ? { loudnessLufs: item.loudness_lufs } : {}),
      ...(typeof item.true_peak_db === "number" ? { truePeakDb: item.true_peak_db } : {}),
    })
  }
  // The API's choice (`is_latest`, the colleagues' current recording where there is one) is listed first and plays
  // by default; the rest keep their order. Without this a song with many archive links could cut it off the list.
  const best = items.findIndex((item) => item.isLatest)
  if (best > 0) items.unshift(...items.splice(best, 1))
  return items
}

export function audioRecordingLabel(item: PlayableAudio, index: number) {
  const title = item.title.trim()
  if (title && !/^(?:audio|recording)$/i.test(title)) return title
  if (index === 0) return "Original rendition"
  const provider = item.provider.replace(/_/g, " ").trim()
  if (provider && provider !== "official") return `Recording ${index + 1} · ${provider}`
  return `Recording ${index + 1}`
}

export function pickPreferredAudioUrl(media: MediaLike[]): string | null {
  const playable = listPlayableAudio(media)
  const latest = playable.find((item) => media.find((row) => row.url === item.url)?.is_latest)
  return latest?.url ?? playable[0]?.url ?? null
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
