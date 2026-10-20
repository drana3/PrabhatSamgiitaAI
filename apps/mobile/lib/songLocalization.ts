import { localeLabel } from "@/constants/languages"
import { fetchSongLocalizationCached, peekSongLocalization } from "@/lib/songCache"

/** Fast meaning translation — does not wait on LLM Central idea generation. */
export async function fetchSongMeaningLocalization(songNumber: number, languageCode: string) {
  const language = localeLabel(languageCode)
  const cached = peekSongLocalization(songNumber, language)
  if (cached?.localized_meaning?.trim()) return cached
  return fetchSongLocalizationCached(songNumber, language)
}

/** Slow path: LLM Central idea when the song has no official purport. */
export async function fetchSongCentralIdeaLocalization(
  songNumber: number,
  languageCode: string,
) {
  const language = localeLabel(languageCode)
  const cached = peekSongLocalization(songNumber, language)
  if (cached?.localized_explanation?.trim()) return cached
  return fetchSongLocalizationCached(songNumber, language, { generateCentralIdea: true })
}
