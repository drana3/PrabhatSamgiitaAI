import type { SongDetail, SongSummary } from "@prabhat/core"

import { scenicArtList, type MockSong, type SongVideo } from "@/data/mock"
import { mediaVideosToEmbeds, pickPreferredAudioUrl } from "@/lib/mediaEmbed"

export function parseSongNumber(songId: string | undefined): number | null {
  if (!songId) return null
  const match = /^ps-(\d+)$/i.exec(songId)
  if (match) return Number(match[1])
  const asNumber = Number(songId)
  return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : null
}

function scenicFor(number: number) {
  return scenicArtList[number % scenicArtList.length]
}

function readLocalizedMeanings(metadata: Record<string, unknown> | undefined): Record<string, string> {
  const raw = metadata?.localized_meanings
  if (!raw || typeof raw !== "object") return {}
  const meanings: Record<string, string> = {}
  for (const [code, text] of Object.entries(raw)) {
    if (typeof text === "string" && text.trim()) {
      meanings[code.toLowerCase()] = text.trim()
    }
  }
  return meanings
}

export function storedMeaningForLanguage(
  song: Pick<MockSong, "meaning" | "hindiMeaning" | "localizedMeanings">,
  language: string,
): string | null {
  const code = language.toLowerCase()
  if (code === "en") return song.meaning?.trim() || null
  if (code === "hi") return song.hindiMeaning?.trim() || null
  return song.localizedMeanings?.[code] ?? null
}

export function songSummaryToMockSong(summary: SongSummary, index = 0): MockSong {
  const scenic = scenicArtList[index % scenicArtList.length]
  const themes = [summary.theme, summary.mood, summary.occasion].filter(Boolean) as string[]

  return {
    id: `ps-${summary.number}`,
    number: summary.number,
    title: summary.title,
    originalTitle: summary.first_line || undefined,
    shortDescription: summary.first_line || summary.theme || "Prabhat Samgiita",
    imageUrl: scenic,
    thumbnailUrl: scenic,
    themes: themes.length ? themes : ["Prabhat Samgiita"],
    meaning: summary.theme || "A song from the Prabhat Samgiita collection.",
    lyrics: summary.first_line || summary.title,
    translation: summary.first_line || summary.title,
    durationSeconds: 300,
    performer: "Prabhat Samgiita Collection",
    videos: [],
    audioUrl: null,
  }
}

export function songDetailToMockSong(detail: SongDetail): MockSong {
  const scenic = scenicFor(detail.number)
  const embeds = mediaVideosToEmbeds(detail.media, scenic, detail.number)
  const videos: SongVideo[] = embeds.map((item) => ({
    id: item.id,
    title: item.title,
    url: item.url,
    embedUrl: item.embedUrl,
    thumbnailUrl: item.thumbnailUrl,
  }))

  const themes = [detail.theme, detail.mood, detail.occasion].filter(Boolean) as string[]

  return {
    id: `ps-${detail.number}`,
    number: detail.number,
    title: detail.title,
    originalTitle: detail.first_line || undefined,
    shortDescription: detail.first_line || detail.theme || "Prabhat Samgiita",
    imageUrl: scenic,
    thumbnailUrl: scenic,
    themes: themes.length ? themes : ["Prabhat Samgiita"],
    meaning:
      detail.english_meaning ||
      detail.meditation_context ||
      detail.theme ||
      "A song from the Prabhat Samgiita collection.",
    hindiMeaning: detail.hindi_meaning?.trim() || null,
    localizedMeanings: readLocalizedMeanings(detail.metadata_json),
    lyrics: detail.lyrics_original || detail.transliteration || detail.first_line || detail.title,
    translation: detail.english_meaning || detail.hindi_meaning || detail.first_line || detail.title,
    durationSeconds: 300,
    performer: "Prabhat Samgiita Collection",
    videos,
    audioUrl: pickPreferredAudioUrl(detail.media),
    mediaHydrated: true,
  }
}
