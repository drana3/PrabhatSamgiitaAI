export type SongMeaningSource = {
  english_meaning?: string | null
  hindi_meaning?: string | null
  metadata_json?: Record<string, unknown> | null
}

export function collectStoredMeanings(song: SongMeaningSource): Record<string, string> {
  const meanings: Record<string, string> = {}
  const english = song.english_meaning?.trim()
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
