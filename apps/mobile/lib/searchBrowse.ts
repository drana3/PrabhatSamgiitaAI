import { allCollections } from "@/data/collections"
import { songNumbersForCategory } from "@/lib/categorySongs"
import type { BrowseTile } from "@/lib/fixtures/home"
import type { StripTone } from "@/lib/homeShelves"
import { SPECIAL_TILES } from "@/lib/songsV2/collections"
import {
  buildCollectionEntries,
  type CollectionEntry,
  type CollectionKind,
  type MoodSource,
} from "@/lib/songsV2/collectionsIndex"

/**
 * The "Browse all" tiles of Search, taken from the data the app really holds and nothing else.
 *
 * One tile per KIND of collection that has at least one non-empty collection: Moods (the six lists of
 * the Songs shelf), Festivals, Themes, Occasions, Seasons, Languages. A tile opens the "All collections"
 * page with that kind already chosen (/collections-v2?kind=...), so every tile lands on a page that is
 * not empty. There is no tile for what the catalogue does not have: no ragas (the `raga` field of the
 * 5,018 songs is empty), no instruments, no "made for you", no "new this month" (all songs are one fixed
 * body of compositions), no "most played" (the app keeps no play counts, only the last 12 songs this
 * person played on this device, which Search shows as "Recently played").
 */

/** Tile order: the moods the listener knows from the Songs shelf first, then the rest. */
export const BROWSE_KIND_ORDER: readonly CollectionKind[] = ["mood", "festival", "theme", "occasion", "season", "language"]

/** The tone cycles with a period of four, so no two neighbours (side by side or one above the other) share one. */
const TONES: readonly StripTone[] = ["orange", "gold", "sage", "forest"]
const COVERS = [3, 2, 1, 4, 6, 5] as const

export type KindTile = BrowseTile & { kind: CollectionKind; count: number }

/** The six special tiles of the Songs shelf with their song counts (what the "Moods" kind is made of). */
export function moodSources(): MoodSource[] {
  return SPECIAL_TILES.map((tile) => ({ id: tile.browseId, label: tile.label, count: songNumbersForCategory(tile.browseId).length }))
}

/** Every collection of the app, as the "All collections" page lists it. */
export function realCollectionEntries(): CollectionEntry[] {
  return buildCollectionEntries(allCollections, moodSources())
}

/** Where a kind tile leads. */
export function kindTarget(kind: CollectionKind): string {
  return `/collections-v2?kind=${kind}`
}

/** One tile per kind that has collections. `label` comes from the caller because it follows the screen language. */
export function browseKindTiles(entries: readonly CollectionEntry[], labelOf: (kind: CollectionKind) => string): KindTile[] {
  const kinds = BROWSE_KIND_ORDER.filter((kind) => entries.some((entry) => entry.kind === kind))
  return kinds.map((kind, index) => ({
    id: kind,
    kind,
    label: labelOf(kind),
    count: entries.filter((entry) => entry.kind === kind).length,
    tone: TONES[index % TONES.length],
    cover: COVERS[index % COVERS.length],
    target: kindTarget(kind),
  }))
}
