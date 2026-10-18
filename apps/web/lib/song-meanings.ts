export type SongMeaningSource = {
  english_meaning?: string | null
  hindi_meaning?: string | null
  language?: string | null
  lyrics_original?: string | null
  first_line?: string | null
  title?: string | null
  metadata_json?: Record<string, unknown> | null
}

export function isEnglishSongLanguage(value?: string | null) {
  const token = value?.trim().toLowerCase() ?? ""
  return token.includes("english") || token === "en" || token === "eng"
}

/** English songs often store the poem in lyrics, not english_meaning. */
export function englishMeaningText(song: SongMeaningSource) {
  const curated = song.english_meaning?.trim()
  if (curated) return curated
  if (!isEnglishSongLanguage(song.language)) return ""
  return song.lyrics_original?.trim() || song.first_line?.trim() || song.title?.trim() || ""
}

export function collectStoredMeanings(song: SongMeaningSource): Record<string, string> {
  const meanings: Record<string, string> = {}
  const english = englishMeaningText(song)
  const hindi = song.hindi_meaning?.trim()
  if (english) meanings.en = english
  if (hindi) meanings.hi = hindi
  const localized = (song.metadata_json?.localized_meanings ?? {}) as Record<string, unknown>
  for (const [code, text] of Object.entries(localized)) {
    if (typeof text === "string" && text.trim()) {
      meanings[code.toLowerCase()] = text.trim()
    }
  }
  return meanings
}

export function storedMeaningForLanguage(song: SongMeaningSource, language: string): string | null {
  return collectStoredMeanings(song)[language.toLowerCase()] ?? null
}

export function hasStoredMeaningForLanguage(song: SongMeaningSource, language: string): boolean {
  return Boolean(storedMeaningForLanguage(song, language))
}
