import { localeOptions, type LocaleOption } from "@/constants/languages"
import {
  SAMPLE_LANGUAGES,
  TRANSLATION_COVERAGE_FIXTURE,
  TRANSLATION_COVERAGE_ORDER,
  type FixtureCoverage,
} from "@/lib/fixtures/translations"
import type { ScriptChoice } from "@/lib/songPage/scripts"
import { matchesLanguage, shortCode } from "@/lib/songPage/translations"

/**
 * Pure logic of the "Script and translations" sheet (prototype LANGUAGE SHEET, Main.dc.html 2289-2313).
 */

export type ScriptRow = { id: ScriptChoice; name: string; sub: string }

export const SCRIPT_ROWS: readonly ScriptRow[] = [
  { id: "roman", name: "Roman", sub: "Latin letters, for example Bandhu, Álo" },
  { id: "devanagari", name: "देवनागरी", sub: "Devanagari" },
  { id: "bengali", name: "বাংলা", sub: "Bengali" },
  { id: "both", name: "Both", sub: "Roman and Devanagari together" },
]

export type LanguageRow = {
  code: string
  name: string
  /** native name and what the language offers */
  native: string
  coverage: FixtureCoverage | null
}

export function coverageText(coverage: FixtureCoverage | null): string {
  if (coverage === "full") return "Lines and word meanings"
  if (coverage === "lines") return "Lines only"
  return "Machine translation"
}

function toRow(option: LocaleOption): LanguageRow {
  const coverage = TRANSLATION_COVERAGE_FIXTURE[option.code] ?? null
  return {
    code: option.code,
    name: option.label,
    native: `${option.nativeLabel} · ${coverageText(coverage)}`,
    coverage,
  }
}

/** Covered languages first, in the prototype's order, then the rest by name; filtered by the search text. */
export function languageRows(query: string, options: readonly LocaleOption[] = localeOptions): LanguageRow[] {
  const filtered = options.filter((option) => matchesLanguage(option, query))
  const rank = (code: string) => {
    const index = (TRANSLATION_COVERAGE_ORDER as readonly string[]).indexOf(code)
    return index < 0 ? TRANSLATION_COVERAGE_ORDER.length : index
  }
  return [...filtered]
    .sort((a, b) => rank(a.code) - rank(b.code) || a.label.localeCompare(b.label))
    .map(toRow)
}

const SCRIPT_SUMMARY: Record<ScriptChoice, string> = {
  roman: "Roman",
  devanagari: "Devanagari",
  bengali: "Bengali",
  both: "Both scripts",
}

/** "Roman + EN + RU": the value of the "Script and translations" row. */
export function languageSummary(script: ScriptChoice, translations: readonly string[]): string {
  return [SCRIPT_SUMMARY[script], ...translations.map(shortCode)].join(" + ")
}

export function languageSearchPlaceholder(total: number = localeOptions.length): string {
  return `Search ${total} languages`
}

export type SampleLanguageRow = {
  code: string
  name: string
  native: string
  /** a language that is not added yet: dimmed name, "Request" button */
  pending: boolean
  action: string
}

/**
 * Preview rows (MOCKUP_DATA): the prototype's 14 languages. Languages not added yet show "Request";
 * once requested the line reads "Requested" and the button goes.
 */
export function sampleLanguageRows(query: string, requested: ReadonlySet<string> = new Set()): SampleLanguageRow[] {
  const q = query.trim().toLowerCase()
  return SAMPLE_LANGUAGES.filter((l) => !q || `${l.name} ${l.native}`.toLowerCase().includes(q)).map((l) => {
    const pending = l.coverage === "none"
    const asked = requested.has(l.code)
    const state =
      l.coverage === "full" ? "Lines and word meanings" : l.coverage === "lines" ? "Lines only" : asked ? "Requested" : "Not added yet"
    return { code: l.code, name: l.name, native: `${l.native} · ${state}`, pending, action: pending && !asked ? "Request" : "" }
  })
}
