import type { SongDetail, SongSummary } from "@prabhat/core"

import type { MockSong, SongVideo } from "@/data/mock"
import { listPlayableAudio, mediaVideosToEmbeds, pickPreferredAudioUrl } from "@/lib/mediaEmbed"
import { scenicHeroFor, scenicThumbFor } from "@/lib/scenicArt"

export function isBareSongTitle(title: string | null | undefined, number: number): boolean {
  const value = title?.trim() ?? ""
  if (!value) return true
  if (value === String(number)) return true
  return new RegExp(`^song\\s+${number}$`, "i").test(value)
}

/** First line / catalog title — never a bare "Song 123" on list rows. */
export function songCardTitle(song: {
  number: number
  title?: string | null
  originalTitle?: string | null
  shortDescription?: string | null
}): string {
  if (!isBareSongTitle(song.title, song.number)) return song.title!.trim()
  const fallback = song.originalTitle?.trim() || song.shortDescription?.trim()
  if (fallback && !isBareSongTitle(fallback, song.number)) return fallback
  return song.title?.trim() || `PS ${song.number}`
}

export function parseSongNumber(songId: string | string[] | undefined): number | null {
  const raw = Array.isArray(songId) ? songId[0] : songId
  if (!raw) return null
  let value = raw.trim()
  try {
    value = decodeURIComponent(value).trim()
  } catch {
    /* keep raw */
  }
  const match = /^ps-(\d+)$/i.exec(value)
  if (match) return Number(match[1])
  const asNumber = Number(value)
  return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : null
}

/** Normalize Expo route params (`ps-12`, `12`, or a one-item array). */
export function songRouteId(songId: string | string[] | undefined): string | undefined {
  const number = parseSongNumber(songId)
  return number ? `ps-${number}` : undefined
}

/** Instant song-page chrome while the API detail is in flight. */
export function songPlaceholder(number: number, extras?: Partial<MockSong>): MockSong {
  return {
    id: `ps-${number}`,
    number,
    title: extras?.title?.trim() || `PS ${number}`,
    originalTitle: extras?.originalTitle,
    shortDescription: extras?.shortDescription || extras?.title || "Prabhat Samgiita",
    imageUrl: extras?.imageUrl || scenicHeroFor(number),
    thumbnailUrl: extras?.thumbnailUrl || scenicThumbFor(number),
    themes: extras?.themes?.length ? extras.themes : ["Prabhat Samgiita"],
    meaning: extras?.meaning || "",
    lyrics: extras?.lyrics || "",
    translation: extras?.translation || "",
    durationSeconds: extras?.durationSeconds || 300,
    performer: extras?.performer || "Prabhat Samgiita Collection",
    videos: extras?.videos ?? [],
    audioUrl: extras?.audioUrl ?? null,
    audioRecordings: extras?.audioRecordings,
    mediaHydrated: extras?.mediaHydrated ?? false,
  }
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

export function isEnglishSongLanguage(value: string | null | undefined) {
  const token = value?.trim().toLowerCase() ?? ""
  return token.includes("english") || token === "en" || token === "eng"
}

export function englishMeaningFromDetail(detail: {
  english_meaning?: string | null
  language?: string | null
  lyrics_original?: string | null
  first_line?: string | null
  title?: string | null
  meditation_context?: string | null
  theme?: string | null
}) {
  const curated = detail.english_meaning?.trim()
  if (curated) return curated
  if (isEnglishSongLanguage(detail.language)) {
    const lyrics =
      detail.lyrics_original?.trim() || detail.first_line?.trim() || detail.title?.trim() || ""
    if (lyrics) return lyrics
  }
  return (
    detail.meditation_context?.trim() ||
    detail.theme ||
    "A song from the Prabhat Samgiita collection."
  )
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
  const number = summary.number || index + 1
  const themes = [summary.theme, summary.mood, summary.occasion].filter(Boolean) as string[]
  const title = isBareSongTitle(summary.title, number)
    ? summary.first_line?.trim() || summary.title
    : summary.title

  return {
    id: `ps-${summary.number}`,
    number: summary.number,
    title,
    originalTitle: summary.first_line || undefined,
    shortDescription: summary.first_line || summary.theme || "Prabhat Samgiita",
    imageUrl: scenicHeroFor(number),
    thumbnailUrl: scenicThumbFor(number),
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

type AudioRecording = NonNullable<MockSong["audioRecordings"]>[number]

/** Union alternate takes by URL — never drop a catalog recording during merge. */
export function mergeRecordingLists(
  ...lists: Array<Array<AudioRecording> | undefined | null>
): AudioRecording[] {
  const seen = new Set<string>()
  const merged: AudioRecording[] = []
  for (const list of lists) {
    for (const item of list ?? []) {
      const url = item.url?.trim()
      if (!url || seen.has(url)) continue
      seen.add(url)
      merged.push(item)
    }
  }
  return merged
}

/** True once GET /songs/{n} has been mapped — not merely a preview URL. */
export function hasCompleteAudioCatalog(
  song: Pick<MockSong, "mediaHydrated" | "audioUrl" | "audioRecordings">,
): boolean {
  if (!song.mediaHydrated) return false
  if ((song.audioRecordings?.length ?? 0) > 0) return true
  return !song.audioUrl?.trim()
}

export function mergeSongMedia(page: MockSong, enriched: MockSong | null | undefined): MockSong {
  if (!enriched || enriched.number !== page.number) return page
  const audioRecordings = mergeRecordingLists(page.audioRecordings, enriched.audioRecordings)
  const audioUrl = page.audioUrl || enriched.audioUrl || null
  const mediaHydrated = hasCompleteAudioCatalog(page) || hasCompleteAudioCatalog(enriched)
  if (
    audioRecordings === page.audioRecordings &&
    audioUrl === page.audioUrl &&
    mediaHydrated === page.mediaHydrated
  ) {
    return page
  }
  return {
    ...page,
    audioRecordings: audioRecordings.length ? audioRecordings : page.audioRecordings,
    audioUrl,
    mediaHydrated,
  }
}

export function songDetailToMockSong(detail: SongDetail, preferredAudioUrl?: string | null): MockSong {
  const hero = scenicHeroFor(detail.number)
  const thumb = scenicThumbFor(detail.number)
  const embeds = mediaVideosToEmbeds(detail.media, thumb, detail.number)
  const videos: SongVideo[] = embeds.map((item) => ({
    id: item.id,
    title: item.title,
    url: item.url,
    embedUrl: item.embedUrl,
    thumbnailUrl: item.thumbnailUrl,
  }))

  const themes = [detail.theme, detail.mood, detail.occasion].filter(Boolean) as string[]
  const recordings = listPlayableAudio(detail.media).slice(0, 8)

  return {
    id: `ps-${detail.number}`,
    number: detail.number,
    title: isBareSongTitle(detail.title, detail.number)
      ? detail.first_line?.trim() || detail.title
      : detail.title,
    originalTitle: detail.first_line || undefined,
    shortDescription: detail.first_line || detail.theme || "Prabhat Samgiita",
    imageUrl: hero,
    thumbnailUrl: thumb,
    themes: themes.length ? themes : ["Prabhat Samgiita"],
    meaning: englishMeaningFromDetail(detail),
    hindiMeaning: detail.hindi_meaning?.trim() || null,
    localizedMeanings: readLocalizedMeanings(detail.metadata_json),
    lyrics: detail.lyrics_original || detail.transliteration || detail.first_line || detail.title,
    transliteration: detail.transliteration?.trim() || null,
    translation: detail.english_meaning || detail.hindi_meaning || detail.first_line || detail.title,
    durationSeconds: 300,
    performer: "Prabhat Samgiita Collection",
    videos,
    audioRecordings: recordings,
    audioUrl: pickPreferredAudioUrl(detail.media, preferredAudioUrl),
    notationSourceUrl: detail.notation_source_url?.trim() || null,
    notationVerificationStatus: detail.notation_verification_status?.trim() || null,
    notationEnabled: detail.notation_enabled === true,
    sargamSubmittedBy: detail.sargam_attribution?.display_name?.trim() || null,
    sargamSubmittedAt: detail.sargam_attribution?.submitted_at ?? null,
    mediaHydrated: true,
  }
}
