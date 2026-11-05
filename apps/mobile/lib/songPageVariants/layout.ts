import type { AlignResult } from "./alignLines"
import type { SongPageVariant } from "./variant"

/**
 * What each variant shows, decided from facts about the song (no React). The screens only draw this, so
 * "which sections exist for which song" is tested here and nowhere else.
 */

export type VariantTab = "read" | "lyrics" | "meaning" | "play" | "watch" | "about"

export type SongFacts = {
  hasLyrics: boolean
  /** a real meaning exists in the language on screen (the official English text, or a stored or fetched translation) */
  hasMeaning: boolean
  /** real word meanings (never the sample ones outside the preview's demo songs) */
  hasWords: boolean
  /** a real chord chart (never the sample one outside the preview's demo songs) */
  hasChords: boolean
  hasVideo: boolean
  hasNotationPdf: boolean
  /** how the meaning lines up with the lyrics (variant A and C) */
  align: AlignResult
}

export type MeaningMode =
  /** B: its own tab, the translation as paragraphs */
  | "tab"
  /** A: translation under each lyric line */
  | "pairs"
  /** A: lyrics block, then the meaning block, with a small note why it is not line by line */
  | "stacked"
  /** C: a fold under each stanza (only where the lines are paired), else one fold under the stanzas */
  | "stanza-folds"
  | "stanza-single"
  /** nothing to show */
  | "none"

export type VariantLayout = {
  tabs: VariantTab[]
  meaning: MeaningMode
  /** A: the "Lyrics | + Meaning" segmented control */
  meaningToggle: boolean
  /** a Words chip: only when real word meanings exist */
  wordsChip: boolean
  /** the quiet line "No word meanings yet." under the lyrics (A and B, when there are none) */
  wordsNote: boolean
  /** C: the Words row (always; its subtitle says there are none) */
  wordsRow: boolean
  /** the Play tab or row shows chords only when a chart exists, else the honest empty state */
  chordsPanel: "chart" | "empty"
  /** A: the stacked fallback gets its small note */
  stackedNote: boolean
}

export function variantLayout(variant: SongPageVariant, facts: SongFacts): VariantLayout {
  const chordsPanel = facts.hasChords ? "chart" : "empty"
  const base = {
    wordsChip: facts.hasWords,
    wordsNote: false,
    wordsRow: false,
    chordsPanel,
    stackedNote: false,
    meaningToggle: false,
  } as const
  if (variant === "a") {
    const mode: MeaningMode = !facts.hasMeaning ? "none" : facts.align.kind === "pairs" ? "pairs" : "stacked"
    return {
      ...base,
      tabs: ["read", "play", "watch", "about"],
      meaning: mode,
      meaningToggle: facts.hasMeaning,
      wordsNote: !facts.hasWords,
      stackedNote: mode === "stacked" && facts.align.kind === "stacked" && (facts.align.reason === "count-differs" || facts.align.reason === "runs-on"),
    }
  }
  if (variant === "c") {
    const mode: MeaningMode = !facts.hasMeaning ? "none" : facts.align.kind === "pairs" ? "stanza-folds" : "stanza-single"
    return { ...base, tabs: [], meaning: mode, wordsRow: true }
  }
  // b, and "current" never reaches here
  return {
    ...base,
    tabs: ["lyrics", "meaning", "play", "watch"],
    meaning: facts.hasMeaning ? "tab" : "none",
    wordsNote: !facts.hasWords,
  }
}
