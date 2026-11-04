import type { MockSong } from "@/data/mock"
import { sampleDuration, searchSample } from "@/lib/fixtures/search"
import type { SearchGroup, SearchResultItem } from "@/lib/unifiedSearch"
import { reasonLabel } from "@/lib/unifiedSearchQuery"

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

export const SEARCH_NO_MATCH = "No song matches that. Try the number, a word from the first line, or a feeling."

export type FlatResult = {
  item: SearchResultItem
  /** "Number match", "First line match", "Word match", "Feeling: peaceful" ... */
  why: string
  /** "4:31", shown after "PS 3". Only the preview sample data has lengths. */
  durationLabel?: string
}

/** "1 song" / "3 songs". */
export function resultCountLabel(count: number): string {
  return `${count} ${count === 1 ? "song" : "songs"}`
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

/** Preview rows (MOCKUP_DATA): the prototype's sample songs and matching rules. */
export function sampleFlatResults(query: string): FlatResult[] {
  return searchSample(query).map(({ song, why }) => ({
    item: {
      song: { id: `ps-${song.number}`, number: song.number, title: song.title } as unknown as MockSong,
      reason: { kind: "first_line" },
      line: song.title,
    },
    why,
    durationLabel: sampleDuration(song.seconds),
  }))
}
