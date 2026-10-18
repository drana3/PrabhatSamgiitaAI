import type { TodayRecommendationItem, TodayRecommendations } from "@prabhat/core"
import { unwrapArchiveAudioUrl } from "@prabhat/core"

import type { MockSong } from "@/data/mock"
import { toInAppVideoEmbedUrl } from "@/lib/mediaEmbed"
import { scenicHeroFor, scenicThumbFor } from "@/lib/scenicArt"

function todayContextSignal(today: TodayRecommendations | null) {
  return today?.signals?.find(
    (signal) => signal.category === "festival" || signal.category === "song_of_the_day",
  )
}

function formatContextDate(isoDate: string | undefined) {
  if (!isoDate) return ""
  const parsed = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return ""
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
}

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
    themes: item.first_line?.trim()
      ? [item.first_line.trim()]
      : item.reasons.slice(0, 2),
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

export function todayHeadline(today: TodayRecommendations | null) {
  if (today?.context?.festival) return today.context.festival
  if (today?.context?.recommendation_mode === "strict_festival") {
    return today.context.festival || "Festival day"
  }
  const signal = todayContextSignal(today)
  if (signal?.category === "festival" && signal.title) return signal.title
  return "Song of the Day"
}

export function todaySummary(today: TodayRecommendations | null) {
  if (today?.context?.recommendation_mode === "strict_festival" || today?.context?.festival) {
    return "Festival songs replace the daily sequence for this observance."
  }
  const signal = todayContextSignal(today)
  const song = today?.recommendations?.[0]
  const firstLine = song?.first_line?.trim()
  if (signal?.summary && firstLine) return `${signal.summary} — ${firstLine}`
  if (signal?.summary) return signal.summary
  const sequence = (today?.context as { song_of_the_day?: number } | undefined)?.song_of_the_day
  if (typeof sequence === "number") {
    const dateLabel = formatContextDate(today?.context?.date)
    return dateLabel ? `PS ${sequence} · ${dateLabel}` : `PS ${sequence} in today’s sequence`
  }
  if (firstLine) return firstLine
  if (song) return `PS ${song.number} — ${song.title}`
  return ""
}

/** Right-side chip: date for daily sequence, not a duplicate “Song of the Day” label. */
export function todayModeLabel(today: TodayRecommendations | null) {
  if (today?.context?.recommendation_mode === "strict_festival" || today?.context?.festival) {
    return "Festival day"
  }
  const signal = todayContextSignal(today)
  const summary = signal?.summary?.trim()
  if (summary?.includes("·")) {
    const datePart = summary.split("·").slice(1).join("·").trim()
    if (datePart) return datePart
  }
  const dateLabel = formatContextDate(today?.context?.date)
  return dateLabel || "Today"
}
