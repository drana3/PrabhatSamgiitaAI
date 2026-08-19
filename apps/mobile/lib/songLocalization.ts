import { localeLabel } from "@/constants/languages"
import { fetchSongLocalizationCached, peekSongLocalization } from "@/lib/songCache"

function pause(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** AI meaning translation — use memory cache first; retry briefly on miss. */
export async function fetchSongMeaningLocalization(songNumber: number, languageCode: string) {
  const language = localeLabel(languageCode)
  const cached = peekSongLocalization(songNumber, language)
  if (cached?.localized_meaning?.trim()) return cached

  const attempts = 2
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await fetchSongLocalizationCached(songNumber, language)
    if (result?.localized_meaning?.trim()) return result
    if (attempt < attempts - 1) {
      await pause(800 * (attempt + 1))
    }
  }

  return fetchSongLocalizationCached(songNumber, language)
}
