import { t } from "@/lib/i18n"
import type { FixtureCoverage } from "@/lib/fixtures/translations"
import { LYRIC_LANGUAGES } from "@/lib/songPage/lyricLanguages"
import type { ScriptChoice } from "@/lib/songPage/scripts"
import { shortCode } from "@/lib/songPage/translations"

/**
 * Pure logic of the "Script and translations" sheet (prototype LANGUAGE SHEET, Main.dc.html 2289-2313).
 */

export type ScriptRow = { id: ScriptChoice; name: string; sub: string }

export const SCRIPT_ROWS: readonly ScriptRow[] = [
  { id: "roman", get name() { return t("scriptSheet.roman") }, get sub() { return t("scriptSheet.roman.sub") } },
  { id: "devanagari", name: "देवनागरी", get sub() { return t("scriptSheet.devanagari.sub") } },
  { id: "bengali", name: "বাংলা", get sub() { return t("scriptSheet.bengali.sub") } },
  { id: "both", get name() { return t("scriptSheet.both") }, get sub() { return t("scriptSheet.both.sub") } },
]

export function coverageText(coverage: FixtureCoverage | null): string {
  if (coverage === "full") return t("scriptSheet.cover.full")
  if (coverage === "lines") return t("scriptSheet.cover.lines")
  if (coverage === "none") return t("scriptSheet.cover.none")
  return ""
}

export type LyricLanguageRow = {
  code: string
  /** the language in its own script */
  name: string
  /** the English name, then (in the preview) what the language offers */
  sub: string
  /** a language the preview has not added yet: dimmed name */
  pending: boolean
}

/**
 * Rows of the translation list: the languages of lib/songPage/lyricLanguages.ts, each in its own
 * script with the English name under it. `coverage` is the preview's sample coverage (MOCKUP_DATA);
 * without it nothing is claimed, because what a song has is per song (see pickShown).
 */
export function lyricLanguageRows(coverage?: Record<string, FixtureCoverage>): LyricLanguageRow[] {
  return LYRIC_LANGUAGES.map((language) => {
    const state = coverage ? coverageText(coverage[language.code] ?? "none") : ""
    const english = language.native === language.name ? "" : language.name
    return {
      code: language.code,
      name: language.native,
      sub: [english, state].filter(Boolean).join(" · "),
      pending: coverage ? (coverage[language.code] ?? "none") === "none" : false,
    }
  })
}

const SCRIPT_SUMMARY: Record<ScriptChoice, () => string> = {
  roman: () => t("scriptSheet.roman"),
  devanagari: () => t("scriptSheet.summary.devanagari"),
  bengali: () => t("scriptSheet.summary.bengali"),
  both: () => t("scriptSheet.summary.both"),
}

/** "Roman + EN + RU": the value of the "Script and translations" row. */
export function languageSummary(script: ScriptChoice, translations: readonly string[]): string {
  return [SCRIPT_SUMMARY[script](), ...translations.map(shortCode)].join(" + ")
}
