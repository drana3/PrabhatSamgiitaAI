import type { CollectionGroup, CollectionItem } from "@/data/collections"
import { t } from "@/lib/i18n"

/** "Dipavali (Colour Festival) Day Songs" -> "Dipavali (Colour Festival) Day". */
export function shortCollectionLabel(label: string): string {
  return label.replace(/\s+Songs?$/i, "").trim() || label
}

export function songCountLabel(count: number): string {
  return t("songs.count", { count })
}

export type FestivalChip = {
  id: string
  label: string
  eyebrow: string
  count: number
  songNumbers: number[]
}

/**
 * Festival chips (spec SCR-17 item 1): collections in the "festival"
 * category that have at least one song, biggest first.
 */
export function festivalChips(collections: readonly CollectionItem[]): FestivalChip[] {
  return collections
    .filter((c) => c.category === "festival" && c.count > 0)
    .map((c) => ({
      id: c.value || c.label,
      label: shortCollectionLabel(c.label),
      eyebrow: t("songs.kindEyebrow.festival", { songs: songCountLabel(c.count) }),
      count: c.count,
      songNumbers: c.songNumbers,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

/** The selected chip, falling back to the first one when the id is stale or empty. */
export function pickFestival(chips: readonly FestivalChip[], id: string | null): FestivalChip | null {
  if (!chips.length) return null
  return chips.find((c) => c.id === id) ?? chips[0]
}

export type TileTone = "forest" | "olive" | "white" | "peach"

export type SpecialTile = {
  id: string
  label: string
  tone: TileTone
  /** id understood by songNumbersForCategory (categorySongs.ts) */
  browseId: string
}

/**
 * Special collections (spec SCR-17 item 3). Tones follow the prototype (olive, white, white,
 * olive, olive, white), so no tile shares a tone with a neighbour in the two-column grid.
 */
export const SPECIAL_TILES: readonly SpecialTile[] = [
  { id: "kiirtan", get label() { return t("kind.kiirtan") }, tone: "olive", browseId: "devotional" },
  { id: "dhyana", label: "Dhyána", tone: "white", browseId: "meditation" },
  { id: "morning", get label() { return t("cat.morning") }, tone: "white", browseId: "morning" },
  { id: "evening", get label() { return t("cat.evening") }, tone: "olive", browseId: "evening" },
  { id: "nature", get label() { return t("cat.nature") }, tone: "olive", browseId: "nature" },
  { id: "children", get label() { return t("cat.children") }, tone: "white", browseId: "children" },
]

export type TileWithCount = SpecialTile & { count: number; countLabel: string }

export function tilesWithCounts(
  tiles: readonly SpecialTile[],
  countFor: (browseId: string) => number,
): TileWithCount[] {
  return tiles.map((tile) => {
    const count = Math.max(0, countFor(tile.browseId))
    return { ...tile, count, countLabel: songCountLabel(count) }
  })
}

/** Grid neighbours (left/right in a row, above/below) that share a tone. */
export function adjacentSameTone(tiles: readonly SpecialTile[], columns = 2): number {
  let clashes = 0
  tiles.forEach((tile, i) => {
    if (i % columns < columns - 1 && tiles[i + 1]?.tone === tile.tone) clashes += 1
    if (tiles[i + columns]?.tone === tile.tone) clashes += 1
  })
  return clashes
}

/** Roughly 200 words a minute, never under one minute. */
export function readMinutes(paragraphs: readonly string[], wordsPerMinute = 200): number {
  const words = paragraphs.join(" ").split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / wordsPerMinute))
}

/** `Story · 4 min read`, or just `Story` while the length is not known. */
export function storyEyebrow(minutes: number | null | undefined): string {
  return minutes && minutes > 0 ? t("songs.storyEyebrow", { minutes }) : t("today.section.story")
}

/**
 * The `All 68` index: groups with the collections that match the query
 * (name, value or group title). An empty query keeps everything. A group
 * that matches by its own title keeps all of its collections.
 */
export function filterCollectionGroups(groups: readonly CollectionGroup[], query: string): CollectionGroup[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...groups]
  return groups
    .map((group) => {
      const groupHit = group.title.toLowerCase().includes(q) || group.id.toLowerCase().includes(q)
      const items = groupHit
        ? group.items
        : group.items.filter((item) => item.label.toLowerCase().includes(q) || item.value.toLowerCase().includes(q))
      return { ...group, items }
    })
    .filter((group) => group.items.length > 0)
}

/** Title of the index entry point: `All 68`. */
export function allCollectionsLabel(total: number): string {
  return t("songs.allN", { total })
}
