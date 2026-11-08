import type { WordGlosses } from "./songContent"

/** The order the word-by-word page lists its languages in; any other language the data has follows, in its own order. */
export const WORD_LANGUAGE_ORDER = ["en", "ru", "es"] as const

/**
 * The languages that really have word meanings for the song, English, Russian and Spanish first. A language with no
 * meaning in the data is not listed: the page never offers a language it has nothing in. New languages need no code
 * change, they appear when the data has them.
 */
export function wordLanguagesOf(glosses: Pick<WordGlosses, "byLanguage"> | null | undefined): string[] {
  if (!glosses) return []
  const have = Object.keys(glosses.byLanguage).filter((code) => Object.keys(glosses.byLanguage[code] ?? {}).length > 0)
  const first = WORD_LANGUAGE_ORDER.filter((code) => have.includes(code))
  return [...first, ...have.filter((code) => !(WORD_LANGUAGE_ORDER as readonly string[]).includes(code))]
}
