import type { LyricStructure } from "./lyricStructure"
import type { PageSection, TabSection } from "./pageSections"

/**
 * The one text block of the song page has three tabs: the lyrics, the commentary (central idea and explanation)
 * and the word-by-word view. Pure rules, no React: which tab a strip or menu jump opens, which strip tab is lit
 * while the block is on screen, and what the word-by-word grid shows.
 */
export type BlockTab = "lyrics" | "commentary" | "words"

export const BLOCK_TABS: readonly BlockTab[] = ["lyrics", "commentary", "words"]

/** The section id that stands for the commentary tab. The id stays "meaning" (strip, menu, anchors); only the label changed. */
export const COMMENTARY_SECTION: TabSection = "meaning"

/** Sections that have their own place in the scroll: Commentary lives inside the Lyrics block, so it has none. */
export function scrollSections<T extends PageSection>(sections: readonly T[]): T[] {
  return sections.filter((id) => id !== COMMENTARY_SECTION)
}

/** The section whose place a jump scrolls to: the commentary tab is part of the Lyrics block. */
export function anchorOf(id: PageSection): PageSection {
  return id === COMMENTARY_SECTION ? "lyrics" : id
}

/** The tab a jump to `id` leaves the block on. Jumping to Commentary opens it; Lyrics leaves Word by word as it is. */
export function blockTabAfterJump(id: PageSection, current: BlockTab): BlockTab {
  if (id === COMMENTARY_SECTION) return "commentary"
  if (id === "lyrics") return current === "commentary" ? "lyrics" : current
  return current
}

/** The strip tab to light: while the reader is in the text block, the commentary tab lights Commentary. */
export function stripActive(active: TabSection, tab: BlockTab): TabSection {
  return active === "lyrics" && tab === "commentary" ? COMMENTARY_SECTION : active
}

/** A word as it is drawn: the marks at its start and end (comma, danda, quotes) are left off, the letters stay. */
export function wordLabel(word: string): string {
  const label = word.replace(/^[^\p{L}\p{M}\p{N}]+/u, "").replace(/[^\p{L}\p{M}\p{N}]+$/u, "")
  return label || word
}

/** The text of a word as the grid compares it: case and punctuation ignored, letters and accents kept exactly. */
export function wordKey(word: string): string {
  return word.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, "")
}

/** `text` is the word as stored; `label` is what the grid draws (marks at its ends, like a comma or a danda, left off). */
export type GridWord = { key: string; text: string; label: string; line: number; index: number }
export type GridLine =
  | { kind: "words"; line: number; number: number; words: GridWord[] }
  /** the line comes back word for word: one small mark, not the words again */
  | { kind: "again"; line: number; text: string }

export type WordGrid = {
  lines: GridLine[]
  /** how many times each word is sung in the whole song, repeated lines included */
  counts: Record<string, number>
  /** different words */
  distinct: number
  /** all sung words */
  total: number
}

/**
 * The words of the song as the interlinear grid draws them, from the lines the page already shows (the stanza
 * structure of the script on screen). A line that repeats an earlier line word for word becomes one "sung again"
 * mark; every sung word still counts, so "appears 4x" is what is really sung.
 */
export function buildWordGrid(structure: Pick<LyricStructure, "blocks">, split: (line: string) => string[]): WordGrid {
  const lines: GridLine[] = []
  const counts: Record<string, number> = {}
  let total = 0
  let shown = 0
  for (const block of structure.blocks) {
    for (const line of block.lines) {
      const words: GridWord[] = []
      split(line.text).forEach((text, index) => {
        const key = wordKey(text)
        if (!key) return
        counts[key] = (counts[key] ?? 0) + 1
        total += 1
        words.push({ key, text, label: wordLabel(text), line: line.index, index })
      })
      if (line.repeatOf !== null) {
        lines.push({ kind: "again", line: line.index, text: line.text })
      } else if (words.length) {
        shown += 1
        lines.push({ kind: "words", line: line.index, number: shown, words })
      }
    }
  }
  return { lines, counts, distinct: Object.keys(counts).length, total }
}
