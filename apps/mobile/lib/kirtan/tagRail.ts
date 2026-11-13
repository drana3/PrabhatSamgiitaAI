import { fitRailChips } from "@/lib/kirtan/tags"
import { normalizedWord } from "@/lib/kirtan/instruments"

/**
 * Many tags on a page, one line (Dada, 9 Nov 2026): the chips that fit whole on ONE line, then a "+N" chip; a tap on it opens the
 * compact sheet with every tag and a search box (components/kirtan/TagRail.tsx). The same estimate of chip widths as the upload
 * form's rail (`fitRailChips`, lib/kirtan/tags.ts), so a page and the form agree. Pure: no React.
 */
export type RailChip = {
  key: string
  label: string
  /** a number shown after the label (how many recordings stand behind it) */
  count?: number
  /** "accent" is the peach chip (an AI-made recording, the Avarta mark) */
  tone?: "plain" | "accent"
  /** pick mode: what a tap on the chip does (a search, a vote). Without it the chip only informs. */
  onPress?: () => void
  a11y?: string
  testID?: string
}

/** A search box is worth showing from this many tags on; fewer are read at a glance. */
export const SEARCH_FROM = 7

/** What the chip reads: the label, and the count after it when there is one. */
export function chipText(chip: Pick<RailChip, "label" | "count">): string {
  return chip.count === undefined ? chip.label : `${chip.label} ${chip.count}`
}

/** The chips that fit on one line of `width` points, and how many are left for "+N". Never hides the chips when all of them fit. */
export function railLine<T extends RailChip>(chips: readonly T[], width: number): { shown: T[]; more: number } {
  const measured = chips.map((chip) => ({ chip, label: chipText(chip) }))
  const { shown, more } = fitRailChips(measured, width)
  return { shown: shown.map((m) => m.chip), more }
}

/** The tags whose label holds what was typed, case, accents and punctuation aside; an empty search shows all. */
export function filterRailChips<T extends RailChip>(chips: readonly T[], query: string): T[] {
  const q = normalizedWord(query)
  if (!q) return [...chips]
  return chips.filter((chip) => normalizedWord(chip.label).includes(q))
}

export function showsSearch(total: number): boolean {
  return total >= SEARCH_FROM
}
