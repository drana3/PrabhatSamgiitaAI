import { localeOptions, type LocaleOption } from "@/constants/languages"

export const MAX_TRANSLATIONS = 2

/** Tap a language in the sheet. A third pick drops the oldest. Tapping a picked one removes it, but never the last. */
export function toggleTranslation(selected: string[], code: string): string[] {
  if (selected.includes(code)) {
    return selected.length > 1 ? selected.filter((item) => item !== code) : selected
  }
  const next = [...selected, code]
  return next.length > MAX_TRANSLATIONS ? next.slice(next.length - MAX_TRANSLATIONS) : next
}

/** Pick one language for the Meaning chips: it moves to the front, the other stays if there is room. */
export function setPrimaryTranslation(selected: string[], code: string): string[] {
  return [code, ...selected.filter((item) => item !== code)].slice(0, MAX_TRANSLATIONS)
}

export function shortCode(code: string): string {
  return code.split("-")[0].toUpperCase()
}

/** `EN`, or `EN + RU`. */
export function translationPill(selected: string[]): string {
  return selected.length ? selected.map(shortCode).join(" + ") : "None"
}

export type Coverage = "full" | "lines" | "meaning" | "none"

export type TranslationRecord = {
  /** translated lines aligned to the lyric lines, null where missing */
  lines?: Array<string | null>
  /** word glosses by word id, with the review flag */
  glosses?: Record<string, { text: string; reviewed: boolean }>
  /** prose meaning for the whole song */
  meaning?: string | null
}

/**
 * Full: lines and at least 95% of glosses reviewed. Lines only: lines but not
 * enough glosses. Meaning only: prose without lines. Otherwise none.
 */
export function coverageOf(record: TranslationRecord | null | undefined, wordCount: number): Coverage {
  if (!record) return "none"
  const lines = record.lines ?? []
  const hasLines = lines.length > 0 && lines.every((line) => Boolean(line?.trim()))
  if (hasLines) {
    const glosses = Object.values(record.glosses ?? {})
    const reviewed = glosses.filter((gloss) => gloss.reviewed && gloss.text.trim()).length
    if (wordCount > 0 && reviewed / wordCount >= 0.95) return "full"
    return "lines"
  }
  return record.meaning?.trim() ? "meaning" : "none"
}

export const COVERAGE_ORDER: Coverage[] = ["full", "lines", "meaning", "none"]

export const COVERAGE_TITLE: Record<Coverage, string> = {
  full: "Full",
  lines: "Lines only",
  meaning: "Meaning only",
  none: "Not yet",
}

export const COVERAGE_HINT: Record<Coverage, string> = {
  full: "Lines and word-by-word meanings",
  lines: "Translated line by line",
  meaning: "One text for the whole song",
  none: "Meaning is translated by machine when you pick it",
}

export type LanguageRow = { option: LocaleOption; coverage: Coverage }

export function matchesLanguage(option: LocaleOption, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    option.label.toLowerCase().includes(q) ||
    option.nativeLabel.toLowerCase().includes(q) ||
    option.code.toLowerCase() === q
  )
}

/** Rows for the sheet, grouped by coverage, filtered by the search text. Empty groups are dropped. */
export function groupLanguages(
  coverageByCode: Record<string, Coverage>,
  query: string,
  options: LocaleOption[] = localeOptions,
): Array<{ coverage: Coverage; rows: LanguageRow[] }> {
  const rows = options
    .filter((option) => matchesLanguage(option, query))
    .map((option) => ({ option, coverage: coverageByCode[option.code] ?? ("none" as Coverage) }))
  return COVERAGE_ORDER.map((coverage) => ({
    coverage,
    rows: rows.filter((row) => row.coverage === coverage),
  })).filter((group) => group.rows.length > 0)
}

/** Put translated lines under lyric lines when the counts match; otherwise do not guess. */
export function alignTranslationLines(lyricLines: string[], text: string | null | undefined): string[] | null {
  if (!text?.trim() || !lyricLines.length) return null
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  return lines.length === lyricLines.length ? lines : null
}

/** Right-to-left languages mirror the translation line only. */
const RTL = new Set(["ar", "he", "iw", "fa", "ur", "ps", "sd", "yi", "dv", "ug", "pa-Arab"])
export function isRtl(code: string): boolean {
  return RTL.has(code)
}
