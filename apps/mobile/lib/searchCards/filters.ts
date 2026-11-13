import type { SearchBySection, SearchByValue } from "@/lib/searchMenu/searchBy"
import type { AuthorStat } from "@/lib/searchMenu/types"

/**
 * The "Filters" of a Search with a query (Dada, 10 Nov 2026): Style, Instrument, Tempo and Performer, hidden under one button.
 * They narrow the Kiirtan results. A filter is a shelf of the Search menu (a style, an instrument, a tempo, an author): the
 * recordings on that shelf (`shelfItems`) are the recordings the filter keeps, so a number on a filter is the number you get.
 * A row with no choices is not shown. Pure: no React, no stores.
 */

export type FilterRowId = "style" | "instrument" | "tempo" | "performer"

export const FILTER_ROW_ORDER: readonly FilterRowId[] = ["style", "instrument", "tempo", "performer"]

export type FilterOption = {
  /** the shelf id (`kiirtan:style:bengali`, `facet:instrument:harmonium`, `author:<key>` ...) */
  shelfId: string
  label: string
  count: number
}

export type FilterRow = { id: FilterRowId; options: FilterOption[] }

/** The most performers offered; the rest stay on the Authors page. */
export const FILTER_MAX_PERFORMERS = 8

export type FilterSelection = Partial<Record<FilterRowId, string>>

function optionOf(value: SearchByValue): FilterOption | null {
  return value.count && value.count > 0 ? { shelfId: value.key, label: value.label, count: value.count } : null
}

/** The rows from the Kiirtan section of "Search by" (style, instrument, tempo) and the performers the library counts. */
export function buildFilterRows(sections: readonly SearchBySection[], authors: readonly Pick<AuthorStat, "key" | "name" | "recordings">[]): FilterRow[] {
  const kiirtan = sections.find((section) => section.id === "kiirtan")
  const rows: FilterRow[] = []
  for (const id of ["style", "instrument", "tempo"] as const) {
    const row = kiirtan?.rows.find((r) => r.id === id)
    const options = (row?.values ?? []).map(optionOf).filter((o): o is FilterOption => o !== null)
    if (options.length) rows.push({ id, options })
  }
  const performers = [...authors]
    .filter((a) => a.recordings > 0)
    .sort((a, b) => b.recordings - a.recordings || a.name.localeCompare(b.name))
    .slice(0, FILTER_MAX_PERFORMERS)
    .map<FilterOption>((a) => ({ shelfId: `author:${a.key}`, label: a.name, count: a.recordings }))
  if (performers.length) rows.push({ id: "performer", options: performers })
  return rows.sort((a, b) => FILTER_ROW_ORDER.indexOf(a.id) - FILTER_ROW_ORDER.indexOf(b.id))
}

/** How many filters are on. */
export function selectedCount(selection: FilterSelection): number {
  return Object.values(selection).filter(Boolean).length
}

/** One choice per row; choosing the one already chosen takes it off. */
export function toggleFilter(selection: FilterSelection, row: FilterRowId, shelfId: string): FilterSelection {
  const next = { ...selection }
  if (next[row] === shelfId) delete next[row]
  else next[row] = shelfId
  return next
}

/** Keeps the items that sit on every chosen shelf. `idsOf` gives the ids of the recordings of a shelf. */
export function applyFilters<T extends { id: string }>(items: readonly T[], selection: FilterSelection, idsOf: (shelfId: string) => ReadonlySet<string>): T[] {
  const chosen = Object.values(selection).filter((v): v is string => Boolean(v))
  if (!chosen.length) return [...items]
  const sets = chosen.map(idsOf)
  return items.filter((item) => sets.every((set) => set.has(item.id)))
}
