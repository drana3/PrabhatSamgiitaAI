import type { TodayRecommendationItem, TodayRecommendations } from "@prabhat/core"
import { unwrapArchiveAudioUrl } from "@prabhat/core"

import type { MockSong } from "@/data/mock"
import { toInAppVideoEmbedUrl } from "@/lib/mediaEmbed"
import { scenicHeroFor, scenicThumbFor } from "@/lib/scenicArt"

const NEWS_CATEGORIES = new Set(["news", "disaster", "humanitarian"])

export function todayItemToMockSong(item: TodayRecommendationItem, index = 0): MockSong {
  const number = item.number || index + 1
  const hero = scenicHeroFor(number)
  const thumb = scenicThumbFor(number)
  const embedUrl = toInAppVideoEmbedUrl(item.video_embed_url)
  const rawAudio = item.audio_url?.trim() || ""
  const audioUrl = rawAudio ? unwrapArchiveAudioUrl(rawAudio) : null

  return {
    id: `ps-${item.number}`,
    number: item.number,
    title: item.title,
    shortDescription: item.first_line || item.reasons[0] || "Song of the Day",
    imageUrl: hero,
    thumbnailUrl: thumb,
    themes: item.reasons.slice(0, 2),
    meaning: item.reasons.join(" · ") || "Song of the Day",
    lyrics: item.first_line || item.title,
    translation: item.first_line || item.title,
    durationSeconds: 300,
    performer: "Prabhat Samgiita Collection",
    videos: embedUrl
      ? [
          {
            id: `video-${item.number}`,
            title: `Watch PS ${item.number}`,
            url: item.video_embed_url || "",
            embedUrl,
            thumbnailUrl: thumb,
          },
        ]
      : [],
    audioUrl,
  }
}

function visibleSignal(today: TodayRecommendations | null) {
  return today?.signals?.find((signal) => !NEWS_CATEGORIES.has((signal.category || "").toLowerCase()))
}

export function todayHeadline(today: TodayRecommendations | null) {
  const song = today?.recommendations?.[0]
  if (today?.context?.festival) return today.context.festival
  if (song) return `PS ${song.number} — ${song.title}`
  const signal = visibleSignal(today)
  if (signal?.title) return signal.title
  return "Song of the Day"
}

export function todaySummary(today: TodayRecommendations | null) {
  if (today?.context?.recommendation_mode === "strict_festival" || today?.context?.festival) {
    return "Festival songs replace the daily sequence for this observance."
  }
  const signal = visibleSignal(today)
  if (signal?.category === "song_of_the_day" && signal.summary) return signal.summary
  return "The same song for everyone on this date, in order from PS 1 through PS 5018."
}

export function todayModeLabel(today: TodayRecommendations | null) {
  const mode = today?.context?.recommendation_mode
  if (mode === "strict_festival" || today?.context?.festival) return "Festival day"
  return "Song of the Day"
}
