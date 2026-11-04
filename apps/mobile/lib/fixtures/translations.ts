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
