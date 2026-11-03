import { groupLetter, plainTitle, formatDuration, type CatalogEntry } from "./entry"

/** The nine sort orders of Songs (spec SCR-30). */
export type SortKey = "num" | "numd" | "az" | "za" | "cat" | "short" | "long" | "new" | "most"

export const DEFAULT_SORT: SortKey = "num"

export type SortOption = {
  key: SortKey
  title: string
  /** short form shown on the list bar button */
  short: string
  subtitle: string
}

export const SORT_OPTIONS: readonly SortOption[] = [
  { key: "num", title: "Number, 1 to 5,018", short: "Number", subtitle: "The order of the book" },
  { key: "numd", title: "Number, 5,018 to 1", short: "Number, reversed", subtitle: "Newest numbers first" },
  { key: "az", title: "Title, A to Z", short: "Title A to Z", subtitle: "Grouped by first letter" },
  { key: "za", title: "Title, Z to A", short: "Title Z to A", subtitle: "Grouped by first letter" },
  { key: "cat", title: "Category", short: "Category", subtitle: "Devotion, Light, Nature and so on" },
  { key: "short", title: "Shortest first", short: "Shortest", subtitle: "For a quick listen" },
  { key: "long", title: "Longest first", short: "Longest", subtitle: "For a long sitting" },
  { key: "new", title: "Recently added", short: "Recent", subtitle: "New recordings and translations" },
  { key: "most", title: "Most listened", short: "Popular", subtitle: "What others play most" },
]

export function isSortKey(value: unknown): value is SortKey {
  return SORT_OPTIONS.some((option) => option.key === value)
}

export function sortOption(key: SortKey): SortOption {
  return SORT_OPTIONS.find((option) => option.key === key) ?? SORT_OPTIONS[0]
}

/**
 * Sorts that need data the API does not send yet (length, added date, play
 * counter) are offered only when at least one row carries that value.
 */
export function availableSortOptions(entries: readonly CatalogEntry[]): SortOption[] {
  const hasDuration = entries.some((e) => e.durationSeconds != null)
  const hasAdded = entries.some((e) => e.addedRank != null)
  const hasPlays = entries.some((e) => e.plays != null)
  return SORT_OPTIONS.filter((option) => {
    if (option.key === "short" || option.key === "long") return hasDuration
    if (option.key === "new") return hasAdded
    if (option.key === "most") return hasPlays
    return true
  })
}

/** A remembered sort that is no longer available falls back to the default. */
export function resolveSort(saved: unknown, available: readonly SortOption[]): SortKey {
  return isSortKey(saved) && available.some((option) => option.key === saved) ? saved : DEFAULT_SORT
}

/** Ascending with unknown values last, stable on the song number. */
function byNullable(
  pick: (e: CatalogEntry) => number | null,
  direction: 1 | -1,
): (a: CatalogEntry, b: CatalogEntry) => number {
  return (a, b) => {
    const x = pick(a)
    const y = pick(b)
    if (x == null && y == null) return a.number - b.number
    if (x == null) return 1
    if (y == null) return -1
    return (x - y) * direction || a.number - b.number
  }
}

const byTitle = (a: CatalogEntry, b: CatalogEntry) =>
  plainTitle(a.title).localeCompare(plainTitle(b.title)) || a.number - b.number

const COMPARATORS: Record<SortKey, (a: CatalogEntry, b: CatalogEntry) => number> = {
  num: (a, b) => a.number - b.number,
  numd: (a, b) => b.number - a.number,
  az: byTitle,
  za: (a, b) => byTitle(b, a),
  cat: (a, b) => a.category.localeCompare(b.category) || byTitle(a, b),
  short: byNullable((e) => e.durationSeconds, 1),
  long: byNullable((e) => e.durationSeconds, -1),
  new: byNullable((e) => e.addedRank, -1),
  most: byNullable((e) => e.plays, -1),
}

export function sortEntries(entries: readonly CatalogEntry[], key: SortKey): CatalogEntry[] {
  return [...entries].sort(COMPARATORS[key])
}

export function isGroupedSort(key: SortKey): boolean {
  return key === "az" || key === "za" || key === "cat"
}

export type ListRow =
  | { kind: "header"; id: string; label: string; groupIndex: number }
  | { kind: "song"; id: string; entry: CatalogEntry; groupIndex: number; railLabel: string }

export type RailGroup = { label: string; rowIndex: number }

function railLabelFor(entry: CatalogEntry, key: SortKey): string {
  switch (key) {
    case "az":
    case "za":
      return groupLetter(entry.title)
    case "cat":
      return entry.category
    case "short":
    case "long":
      return formatDuration(entry.durationSeconds) ?? ""
    default:
      return `PS ${entry.number}`
  }
}

/**
 * Flat list for the FlatList: A to Z, Z to A and Category insert a header row
 * before each group. `groups` feeds the fast-scroll rail (one tick per group).
 */
export function buildRows(
  entries: readonly CatalogEntry[],
  key: SortKey,
): { rows: ListRow[]; groups: RailGroup[] } {
  const sorted = sortEntries(entries, key)
  const grouped = isGroupedSort(key)
  const rows: ListRow[] = []
  const groups: RailGroup[] = []
  let last: string | null = null
  for (const entry of sorted) {
    const label = railLabelFor(entry, key)
    if (grouped && label !== last) {
      last = label
      groups.push({ label, rowIndex: rows.length })
      rows.push({ kind: "header", id: `h:${label}`, label, groupIndex: groups.length - 1 })
    }
    rows.push({
      kind: "song",
      id: `s:${entry.number}`,
      entry,
      groupIndex: Math.max(0, groups.length - 1),
      railLabel: label,
    })
  }
  return { rows, groups }
}
