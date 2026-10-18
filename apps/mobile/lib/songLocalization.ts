import { localeLabel } from "@/constants/languages"
import { fetchSongLocalizationCached, peekSongLocalization } from "@/lib/songCache"

/** AI meaning translation — memory cache first, then one live fetch. */
export async function fetchSongMeaningLocalization(songNumber: number, languageCode: string) {
  const language = localeLabel(languageCode)
  const cached = peekSongLocalization(songNumber, language)
  if (cached?.localized_meaning?.trim()) return cached
  return fetchSongLocalizationCached(songNumber, language)
}
