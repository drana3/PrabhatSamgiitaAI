import type { CollectionItem } from "@/data/collections"
import { shortCollectionLabel, songCountLabel } from "@/lib/songsV2/collections"

/**
 * "All collections" page: pure logic. Every collection of the app in one list with a kind (festival,
 * theme, mood, occasion, season, language), searchable by name and filterable by kind.
 * "Moods" are the six special tiles of the Songs shelf (Kiirtan, Dhyána, Morning, ...); the other kinds
 * are the categories of the bundled collection data.
 */
export type CollectionKind = "festival" | "theme" | "mood" | "occasion" | "season" | "language"
export type CollectionKindFilter = "all" | CollectionKind

/** Order of the chips; the grid follows the same order. */
export const KIND_ORDER: readonly CollectionKind[] = ["festival", "theme", "mood", "occasion", "season", "language"]

const KIND_PLURAL: Record<CollectionKind, string> = {
  festival: "Festivals",
  theme: "Themes",
  mood: "Moods",
  occasion: "Occasions",
  season: "Seasons",
  language: "Languages",
}
const KIND_SINGULAR: Record<CollectionKind, string> = {
  festival: "Festival",
  theme: "Theme",
  mood: "Mood",
  occasion: "Occasion",
  season: "Season",
  language: "Language",
}

export const EMPTY_COLLECTIONS_TEXT = "No collection matches. Try another word."

export type CollectionEntry = {
  /** what songs-v2-collection understands as `id` (a category id or a collection label) */
  id: string
  /** shown name, "Songs" suffix dropped */
  label: string
  kind: CollectionKind
  count: number
  countLabel: string
  /** position in the full list: a tile keeps its colour while the list is filtered */
  toneIndex: number
}

/** A special tile of the Songs shelf, already counted. */
export type MoodSource = { id: string; label: string; count: number }

/** Category of the data -> kind. Unknown categories count as themes. */
export function kindOfCategory(category: string): CollectionKind {
  switch (category) {
    case "festival":
    case "occasion":
    case "season":
    case "language":
    case "theme":
      return category
    default:
      return "theme"
  }
}

export function kindLabel(kind: CollectionKind, plural = false): string {
  return plural ? KIND_PLURAL[kind] : KIND_SINGULAR[kind]
}

/** Lower case, accents and punctuation gone: "Dhyána" matches "dhyana". */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

/**
 * Moods first (they are the shelf the listener knows), then festivals, themes, occasions, seasons,
 * languages; inside a kind the bigger collection first, then A to Z. Empty collections are dropped, and a
 * collection with the same name as a mood (Children) is shown once, as the mood.
 */
export function buildCollectionEntries(items: readonly CollectionItem[], moods: readonly MoodSource[]): CollectionEntry[] {
  const moodNames = new Set(moods.map((m) => normalizeText(m.label)))
  const raw: Omit<CollectionEntry, "toneIndex">[] = []
  for (const m of moods) {
    raw.push({ id: m.id, label: m.label, kind: "mood", count: Math.max(0, m.count), countLabel: songCountLabel(Math.max(0, m.count)) })
  }
  for (const item of items) {
    if (item.count <= 0) continue
    const label = shortCollectionLabel(item.label)
    if (moodNames.has(normalizeText(label))) continue
    raw.push({ id: item.label, label, kind: kindOfCategory(item.category), count: item.count, countLabel: songCountLabel(item.count) })
  }
  const rank = (kind: CollectionKind) => (kind === "mood" ? 0 : 1 + KIND_ORDER.indexOf(kind))
  return raw
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const byKind = rank(a.entry.kind) - rank(b.entry.kind)
      if (byKind !== 0) return byKind
      // moods keep the shelf order; the other kinds go by size, then name
      if (a.entry.kind === "mood") return a.index - b.index
      return b.entry.count - a.entry.count || a.entry.label.localeCompare(b.entry.label)
    })
    .map(({ entry }, toneIndex) => ({ ...entry, toneIndex }))
}

/** Entries of the kind (all kinds for "all") whose name contains every word of the query. */
export function filterCollections(
  entries: readonly CollectionEntry[],
  query: string,
  kind: CollectionKindFilter = "all",
): CollectionEntry[] {
  const words = normalizeText(query).split(" ").filter(Boolean)
  return entries.filter((entry) => {
    if (kind !== "all" && entry.kind !== kind) return false
    if (!words.length) return true
    const name = normalizeText(entry.label)
    return words.every((word) => name.includes(word))
  })
}

export type KindChip = { id: CollectionKindFilter; label: string; count: number }

/** "All" first, then every kind that has at least one collection, in chip order. */
export function kindChips(entries: readonly CollectionEntry[]): KindChip[] {
  const chips: KindChip[] = [{ id: "all", label: "All", count: entries.length }]
  for (const kind of KIND_ORDER) {
    const count = entries.filter((e) => e.kind === kind).length
    if (count > 0) chips.push({ id: kind, label: KIND_PLURAL[kind], count })
  }
  return chips
}

/** "68 collections" / "3 of 68" while a search or a kind narrows the list. */
export function collectionsCountLabel(shown: number, total: number): string {
  if (shown === total) return `${total} ${total === 1 ? "collection" : "collections"}`
  return `${shown} of ${total}`
}

/** href of the collection page for an entry. */
export function collectionHref(entry: Pick<CollectionEntry, "id" | "label">): string {
  return `/songs-v2-collection?id=${encodeURIComponent(entry.id)}&title=${encodeURIComponent(entry.label)}`
}
