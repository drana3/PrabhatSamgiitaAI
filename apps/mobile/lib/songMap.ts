import {
  dropLastNonemptyLine,
  extractTrailingEnglishTheme,
  type SongDetail,
  type SongSummary,
} from "@prabhat/core"

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

/** Lightweight song shell for instant navigation from search rows. */
export function songPlaceholder(
  number: number,
  partial?: { title?: string; shortDescription?: string; first_line?: string },
): MockSong {
  const hero = scenicHeroFor(number)
  const thumb = scenicThumbFor(number)
  const title = partial?.title?.trim() || partial?.first_line?.trim() || `PS ${number}`
  return {
    id: `ps-${number}`,
    number,
    title,
    shortDescription: partial?.shortDescription?.trim() || partial?.first_line?.trim() || title,
    imageUrl: hero,
    thumbnailUrl: thumb,
    themes: ["Prabhat Samgiita"],
    meaning: "",
    lyrics: "",
    translation: "",
    durationSeconds: 300,
    performer: "Prabhat Samgiita Collection",
    videos: [],
    audioUrl: null,
    mediaHydrated: false,
  }
}

export function parseSongNumber(songId: string | undefined): number | null {
  if (!songId) return null
  const match = /^ps-(\d+)$/i.exec(songId)
  if (match) return Number(match[1])
  const asNumber = Number(songId)
  return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : null
}

/** Expo Router may pass `string | string[]` on Android. */
export function routeString(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string" && value.trim()) return value
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) return value[0]
  return undefined
}

function readLocalizedStringMap(
  metadata: Record<string, unknown> | undefined,
  key: string,
): Record<string, string> {
  const raw = metadata?.[key]
  if (!raw || typeof raw !== "object") return {}
  const out: Record<string, string> = {}
  for (const [code, text] of Object.entries(raw)) {
    if (typeof text === "string" && text.trim()) {
      out[code.toLowerCase()] = text.trim()
    }
  }
  return out
}

function readLocalizedMeanings(metadata: Record<string, unknown> | undefined): Record<string, string> {
  return readLocalizedStringMap(metadata, "localized_meanings")
}

function readLocalizedExplanations(
  metadata: Record<string, unknown> | undefined,
): Record<string, string> {
  return readLocalizedStringMap(metadata, "localized_explanations")
}

export function isEnglishSongLanguage(value: string | null | undefined) {
  const token = value?.trim().toLowerCase() ?? ""
  return token.includes("english") || token === "en" || token === "eng"
}

/** Poem lives in english_meaning with empty lyric columns (PS 68; seed may say Roman). */
export function englishPoemAsLyrics(detail: {
  lyrics_original?: string | null
  transliteration?: string | null
  english_meaning?: string | null
  language?: string | null
}): boolean {
  const poem = detail.english_meaning?.trim() || ""
  if (!poem) return false
  if (detail.lyrics_original?.trim() || detail.transliteration?.trim()) return false
  if (isEnglishSongLanguage(detail.language)) return true
  // Seed/catalog sometimes tags English verse as "Roman" with only english_meaning filled.
  return poem.includes("\n")
}

/** English catalog songs often store the poem only in english_meaning. */
export function lyricsTextFromDetail(detail: {
  lyrics_original?: string | null
  transliteration?: string | null
  english_meaning?: string | null
  language?: string | null
  first_line?: string | null
  title?: string | null
}): string {
  const original = detail.lyrics_original?.trim() || ""
  if (original) return original
  const translit = detail.transliteration?.trim() || ""
  if (translit) return translit
  if (englishPoemAsLyrics(detail)) {
    return detail.english_meaning!.trim()
  }
  return detail.first_line?.trim() || detail.title?.trim() || ""
}

export function englishMeaningFromDetail(detail: {
  english_meaning?: string | null
  language?: string | null
  lyrics_original?: string | null
  transliteration?: string | null
  first_line?: string | null
  title?: string | null
  meditation_context?: string | null
  theme?: string | null
  central_idea?: string | null
  metadata_json?: Record<string, unknown> | null
}) {
  const curated = detail.english_meaning?.trim() || ""
  // When the English poem lives only in english_meaning, that text is the lyric —
  // Meaning should prefer Central idea / theme instead of repeating the poem.
  if (englishPoemAsLyrics(detail) && curated) {
    const purport =
      detail.central_idea?.trim() ||
      (typeof detail.metadata_json?.purport === "string"
        ? detail.metadata_json.purport.trim()
        : "")
    return (
      purport ||
      detail.meditation_context?.trim() ||
      detail.theme?.trim() ||
      "A song from the Prabhat Samgiita collection."
    )
  }
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

/** Unwrap soft line-wraps; collapse bogus one-line paragraphs from translators. */
export function normalizeProseBlock(text: string): string {
  const paragraphs = text
    .trim()
    .split(/\n\s*\n/)
    .map((block) => block.replace(/[ \t]*\n[ \t]*/g, " ").replace(/ {2,}/g, " ").trim())
    .filter(Boolean)
  if (!paragraphs.length) return ""
  if (paragraphs.length >= 4) {
    const short = paragraphs.filter((part) => part.length < 90).length
    if (short / paragraphs.length >= 0.7) {
      return paragraphs.join(" ").replace(/ {2,}/g, " ").trim()
    }
  }
  return paragraphs.join("\n\n")
}

export function storedMeaningForLanguage(
  song: Pick<MockSong, "meaning" | "hindiMeaning" | "localizedMeanings">,
  language: string,
): string | null {
  const code = language.toLowerCase()
  if (code === "en") {
    const value = song.meaning?.trim()
    return value ? normalizeProseBlock(value) : null
  }
  if (code === "hi") {
    const value = song.hindiMeaning?.trim()
    return value ? normalizeProseBlock(value) : null
  }
  const value = song.localizedMeanings?.[code]
  return value?.trim() ? normalizeProseBlock(value) : null
}

export function storedExplanationForLanguage(
  song: Pick<MockSong, "localizedExplanations" | "centralIdea" | "meaning" | "hindiMeaning">,
  language: string,
): string | null {
  const code = language.trim().toLowerCase()
  if (!code) return null
  const value = song.localizedExplanations?.[code]
  if (typeof value !== "string" || !value.trim()) return null
  const prose = normalizeProseBlock(value)
  if (!prose) return null
  const official = song.centralIdea?.trim() ? normalizeProseBlock(song.centralIdea) : ""
  if (official && prose === official) return null
  const fingerprint = (text: string) =>
    text
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\u0900-\u097F]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
  const explFp = fingerprint(prose)
  for (const raw of [song.meaning, song.hindiMeaning]) {
    if (!raw?.trim()) continue
    const other = fingerprint(normalizeProseBlock(raw))
    if (!other) continue
    if (explFp === other) return null
    const shorter = explFp.length <= other.length ? explFp : other
    const longer = explFp.length <= other.length ? other : explFp
    if (longer.length >= 80 && shorter.length / longer.length >= 0.82) return null
  }
  return prose
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

export function songDetailToMockSong(detail: SongDetail): MockSong {
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

  const lyricSource = lyricsTextFromDetail(detail)
  const { lyrics: romanClean, theme: peeledTheme } = extractTrailingEnglishTheme(lyricSource)
  const meta = detail.metadata_json ?? {}
  const officialTheme =
    (typeof meta.official_theme_label === "string" && meta.official_theme_label.trim()) ||
    peeledTheme ||
    detail.theme?.trim() ||
    null
  const englishSong =
    isEnglishSongLanguage(detail.language) || englishPoemAsLyrics(detail)
  // Phonetic Devanagari of English verse is not useful — keep Roman only.
  let lyricsDevanagari = englishSong ? null : detail.lyrics_devanagari?.trim() || null
  if (peeledTheme && lyricsDevanagari) {
    const romanN = romanClean.split("\n").filter((ln) => ln.trim()).length
    const devN = lyricsDevanagari.split("\n").filter((ln) => ln.trim()).length
    if (devN === romanN + 1) {
      lyricsDevanagari = dropLastNonemptyLine(lyricsDevanagari).trim() || null
    }
  }
  const themes = [officialTheme || detail.theme, detail.mood, detail.occasion].filter(
    Boolean,
  ) as string[]
  const centralIdea = (() => {
    const raw =
      detail.central_idea?.trim() ||
      (typeof meta.purport === "string" ? meta.purport.trim() : "") ||
      ""
    return raw ? normalizeProseBlock(raw) : null
  })()

  return {
    id: `ps-${detail.number}`,
    number: detail.number,
    title: isBareSongTitle(detail.title, detail.number)
      ? detail.first_line?.trim() || detail.title
      : detail.title,
    originalTitle: detail.first_line || undefined,
    shortDescription: detail.first_line || officialTheme || detail.theme || "Prabhat Samgiita",
    imageUrl: hero,
    thumbnailUrl: thumb,
    themes: themes.length ? themes : ["Prabhat Samgiita"],
    meaning: englishMeaningFromDetail(detail),
    centralIdea,
    hindiMeaning: detail.hindi_meaning?.trim() || null,
    localizedMeanings: readLocalizedMeanings(detail.metadata_json),
    localizedExplanations: readLocalizedExplanations(detail.metadata_json),
    lyrics: romanClean || detail.first_line || detail.title,
    language: detail.language?.trim() || null,
    transliteration: detail.transliteration?.trim() || null,
    lyricsDevanagari,
    devanagariStatus: englishSong ? "none" : detail.devanagari_status || "none",
    translation: detail.english_meaning || detail.hindi_meaning || detail.first_line || detail.title,
    durationSeconds: 300,
    performer: "Prabhat Samgiita Collection",
    videos,
    audioUrl: pickPreferredAudioUrl(detail.media),
    audioRecordings: listPlayableAudio(detail.media).slice(0, 5),
    notationSourceUrl: detail.notation_source_url?.trim() || null,
    mediaHydrated: true,
  }
}
