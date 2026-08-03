import type { TodayRecommendationItem, TodayRecommendations } from "@prabhat/core"

import type { MockSong } from "@/data/mock"
import { toInAppVideoEmbedUrl } from "@/lib/mediaEmbed"

const SCENIC = [
  "https://images.unsplash.com/photo-1495616811223-4d98b6e70c9a?w=1200&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=80",
]

export function todayItemToMockSong(item: TodayRecommendationItem, index = 0): MockSong {
  const scenic = SCENIC[index % SCENIC.length]
  const embedUrl = toInAppVideoEmbedUrl(item.video_embed_url)
  const audioUrl = item.audio_url?.trim() || null

  return {
    id: `ps-${item.number}`,
    number: item.number,
    title: item.title,
    shortDescription: item.first_line || item.reasons[0] || "Recommended for today",
    imageUrl: scenic,
    thumbnailUrl: scenic,
    themes: item.reasons.slice(0, 2),
    meaning: item.reasons.join(" · ") || "A song selected for today’s context.",
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
            thumbnailUrl: scenic,
          },
        ]
      : [],
    audioUrl,
  }
}

export function todayHeadline(today: TodayRecommendations | null) {
  const signal = today?.signals?.[0]
  if (signal?.title) return signal.title
  if (today?.context?.festival) return today.context.festival
  if (today?.context?.observance) return today.context.observance
  return "Selected for this moment"
}

export function todaySummary(today: TodayRecommendations | null) {
  const signal = today?.signals?.[0]
  if (signal?.summary) return signal.summary
  if (today?.context?.recommendation_mode === "strict_festival") {
    return "Festival selections use reviewed Ananda Marga observance collections."
  }
  return "Songs chosen from today’s observance, important world days, and reviewed humanitarian context."
}

export function todayModeLabel(today: TodayRecommendations | null) {
  const mode = today?.context?.recommendation_mode
  if (mode === "strict_festival" || today?.context?.festival) return "Festival day"
  if (today?.context?.humanitarian_context) return "Humanitarian context"
  const category = today?.signals?.[0]?.category?.toLowerCase()
  if (category === "festival") return "Festival day"
  if (category === "disaster" || category === "humanitarian") return "Humanitarian context"
  if (category) return category.replace(/_/g, " ")
  return "Daily selection"
}
