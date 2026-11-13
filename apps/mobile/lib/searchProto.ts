import type { SearchGroup, SearchResultItem } from "@/lib/unifiedSearch"
import { reasonLabel } from "@/lib/unifiedSearchQuery"
import { getActiveLanguage, t, translatorFor, type TranslateFn } from "@/lib/i18n"

/**
 * Copy and shape of the prototype's search overlay (Main.dc.html, SEARCH OVERLAY and the
 * `hints` / `feelLabels` lists). Pure logic, no React.
 */

export const SEARCH_INPUT_PLACEHOLDER = "Try 3, bandhu or peaceful"

/** The three "Write anything" rows: tapping one fills the field with the example. */
export const SEARCH_HINT_ROWS = [
  { id: "number", label: "A number", example: "3" },
  { id: "words", label: "A name or first line", example: "bandhu he niye calo" },
  { id: "feeling", label: "A feeling", example: "peaceful" },
] as const

export const SEARCH_FEELING_CHIPS = [
  "Peaceful devotion",
  "Longing",
  "Dawn",
  "Gratitude",
  "Surrender",
  "Guidance",
  "Nature",
  "Joy",
] as const

export const SEARCH_INTRO = "A number, a name or first line, or how you feel. No need to choose first."

const FEELING_KEYS = {
  "Peaceful devotion": "searchHints.chip.peaceful",
  Longing: "searchHints.chip.longing",
  Dawn: "searchHints.chip.dawn",
  Gratitude: "searchHints.chip.gratitude",
  Surrender: "searchHints.chip.surrender",
  Guidance: "searchHints.chip.guidance",
  Nature: "searchHints.chip.nature",
  Joy: "searchHints.chip.joy",
} as const

/** A chip's label in the screen language. The English text stays what is typed into the search. */
export function feelingLabel(query: (typeof SEARCH_FEELING_CHIPS)[number], tr: TranslateFn = translatorFor(getActiveLanguage())): string {
  return tr(FEELING_KEYS[query])
}

/** A hint row's label in the screen language. The example stays English (it is the search text). */
export function hintRowLabel(id: (typeof SEARCH_HINT_ROWS)[number]["id"], tr: TranslateFn = translatorFor(getActiveLanguage())): string {
  return tr(`searchHints.row.${id}`)
}

export const SEARCH_NO_MATCH = "No song matches that. Try the number, a word from the first line, or a feeling."

/** The no-match line in the screen language. */
export function searchNoMatch(): string {
  return t("search.noMatch")
}

export type FlatResult = {
  item: SearchResultItem
  /** "Number match", "First line match", "Word match", "Feeling: peaceful" ... */
  why: string
  /** "4:31", shown after "PS 3". The search index has no lengths, so it is empty for now. */
  durationLabel?: string
}

/** "1 song" / "3 songs". */
export function resultCountLabel(count: number): string {
  return t("search.count", { count })
}

/**
 * The prototype lists songs in one column, each with the reason it matched. The engine groups
 * them (number, lyrics, meaning); this flattens the groups in order and drops repeats.
 */
export function flattenResults(groups: readonly SearchGroup[]): FlatResult[] {
  const seen = new Set<number | string>()
  const out: FlatResult[] = []
  for (const group of groups) {
    for (const item of group.items) {
      const key = item.song.number
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ item, why: reasonLabel(item.reason) })
    }
  }
  return out
}
