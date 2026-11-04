/**
 * TODO(api): how well each language is covered. The prototype lists English, Russian and French as
 * "Lines and word meanings", Hindi and Spanish as "Lines only". The API does not report coverage per
 * language yet; every other language is offered through machine translation (see lib/songPage/translations.ts).
 */
export type FixtureCoverage = "full" | "lines"

export const TRANSLATION_COVERAGE_FIXTURE: Record<string, FixtureCoverage> = {
  en: "full",
  ru: "full",
  fr: "full",
  hi: "lines",
  es: "lines",
}

/** Order of the covered languages at the top of the sheet. */
export const TRANSLATION_COVERAGE_ORDER = ["en", "ru", "fr", "hi", "es"] as const

/**
 * Preview sample (MOCKUP_DATA): the prototype's 14 languages and the number it shows in the search
 * placeholder. "none" languages are not added yet and offer a Request button.
 */
export type SampleLanguage = { code: string; name: string; native: string; coverage: FixtureCoverage | "none" }

export const SAMPLE_LANGUAGES: readonly SampleLanguage[] = [
  { code: "en", name: "English", native: "English", coverage: "full" },
  { code: "ru", name: "Russian", native: "Русский", coverage: "full" },
  { code: "fr", name: "French", native: "Français", coverage: "full" },
  { code: "hi", name: "Hindi", native: "हिन्दी", coverage: "lines" },
  { code: "es", name: "Spanish", native: "Español", coverage: "lines" },
  { code: "bn", name: "Bengali", native: "বাংলা", coverage: "none" },
  { code: "de", name: "German", native: "Deutsch", coverage: "none" },
  { code: "it", name: "Italian", native: "Italiano", coverage: "none" },
  { code: "pt", name: "Portuguese", native: "Português", coverage: "none" },
  { code: "ja", name: "Japanese", native: "日本語", coverage: "none" },
  { code: "zh", name: "Chinese", native: "中文", coverage: "none" },
  { code: "pl", name: "Polish", native: "Polski", coverage: "none" },
  { code: "uk", name: "Ukrainian", native: "Українська", coverage: "none" },
  { code: "tr", name: "Turkish", native: "Türkçe", coverage: "none" },
]

export const SAMPLE_LANGUAGE_COUNT = 191
