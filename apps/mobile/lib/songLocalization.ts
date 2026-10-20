import { localeLabel } from "@/constants/languages"
import {
  fetchSongLocalizationCached,
  forgetSongLocalization,
  peekSongLocalization,
} from "@/lib/songCache"

type LocalizationFetchOptions = { force?: boolean }

/** Fast meaning translation — does not wait on LLM Central idea generation. */
export async function fetchSongMeaningLocalization(
  songNumber: number,
  languageCode: string,
  options: LocalizationFetchOptions = {},
) {
  const language = localeLabel(languageCode)
  if (options.force) {
    forgetSongLocalization(songNumber, language)
  } else {
    const cached = peekSongLocalization(songNumber, language)
    if (cached?.localized_meaning?.trim()) return cached
  }
  return fetchSongLocalizationCached(songNumber, language, { force: options.force })
}

/** Slow path: LLM Central idea when the song has no official purport. */
export async function fetchSongCentralIdeaLocalization(
  songNumber: number,
  languageCode: string,
  options: LocalizationFetchOptions = {},
) {
  const language = localeLabel(languageCode)
  if (options.force) {
    forgetSongLocalization(songNumber, language)
  } else {
    const cached = peekSongLocalization(songNumber, language)
    if (cached?.localized_explanation?.trim()) return cached
  }
  return fetchSongLocalizationCached(songNumber, language, {
    generateCentralIdea: true,
    force: options.force,
  })
}
