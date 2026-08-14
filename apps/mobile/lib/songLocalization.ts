import { localeLabel } from "@/constants/languages"
import { api } from "@/lib/client"

function pause(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** AI meaning translation can take ~70s on first request; retry on transient failures. */
export async function fetchSongMeaningLocalization(songNumber: number, languageCode: string) {
  const language = localeLabel(languageCode)
  const attempts = 3

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await api.fetchSongLocalization(songNumber, language)
    if (result?.localized_meaning?.trim()) return result
    if (attempt < attempts - 1) {
      await pause(1200 * (attempt + 1))
    }
  }

  return api.fetchSongLocalization(songNumber, language)
}
