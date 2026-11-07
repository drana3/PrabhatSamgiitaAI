/**
 * TODO(api): how well each language is covered. The prototype lists English and Russian as "Lines and
 * word meanings" and Hindi and Spanish as "Lines only"; Chinese is not added yet. The API does not
 * report coverage per language yet. Only the languages of lib/songPage/lyricLanguages.ts are offered.
 */
export type FixtureCoverage = "full" | "lines" | "none"

export const TRANSLATION_COVERAGE_FIXTURE: Record<string, FixtureCoverage> = {
  en: "full",
  ru: "full",
  es: "lines",
  hi: "lines",
  "zh-CN": "none",
  "zh-TW": "none",
}
