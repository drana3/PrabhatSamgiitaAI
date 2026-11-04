import { useCallback, useEffect, useMemo, useState } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"

import { songNumbersForCategory } from "@/lib/categorySongs"
import type { CatalogEntry } from "@/lib/songsV2/entry"
import {
  activeFilterCount,
  applyFilters,
  EMPTY_FILTERS,
  filterTokens,
  languageOptions,
  restrictToNumbers,
  type FilterState,
} from "@/lib/songsV2/filters"
import { availableSortOptions, buildRows, DEFAULT_SORT, isGroupedSort, resolveSort, type SortKey } from "@/lib/songsV2/sort"

const SORT_KEY = "ps-songs-v2-sort"

/**
 * State of the Catalog segment: chip, filters, sort and which sheet is open.
 * It lives above the segment so the sheets can be drawn over the whole
 * screen, not only over the list.
 */
export function useCatalogController(entries: CatalogEntry[]) {
  const [chip, setChip] = useState<string>("all")
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT)
  const [sortOpen, setSortOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [menuEntry, setMenuEntry] = useState<CatalogEntry | null>(null)

  const sortOptions = useMemo(() => availableSortOptions(entries), [entries])
  const effectiveSort = resolveSort(sort, sortOptions)

  // The order is remembered per user (spec SCR-30).
  useEffect(() => {
    let active = true
    AsyncStorage.getItem(SORT_KEY)
      .then((saved) => {
        if (active && saved) setSort(saved as SortKey)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  const pickSort = useCallback((key: SortKey) => {
    setSort(key)
    setSortOpen(false)
    AsyncStorage.setItem(SORT_KEY, key).catch(() => undefined)
  }, [])

  const chipNumbers = useMemo(() => (chip === "all" ? null : new Set(songNumbersForCategory(chip))), [chip])
  const filtered = useMemo(() => applyFilters(restrictToNumbers(entries, chipNumbers), filters), [entries, chipNumbers, filters])
  const built = useMemo(() => buildRows(filtered, effectiveSort), [filtered, effectiveSort])
  const rows = built.rows
  const groups = built.groups
  const languages = useMemo(() => languageOptions(entries), [entries])

  const clearAll = useCallback(() => {
    setFilters(EMPTY_FILTERS)
    setChip("all")
  }, [])

  return {
    chip,
    setChip,
    filters,
    setFilters,
    filterCount: activeFilterCount(filters),
    tokens: filterTokens(filters),
    sortOptions,
    sort: effectiveSort,
    pickSort,
    sortOpen,
    setSortOpen,
    filterOpen,
    setFilterOpen,
    menuEntry,
    setMenuEntry,
    filtered,
    rows,
    groups,
    grouped: isGroupedSort(effectiveSort),
    languages,
    clearAll,
  }
}

export type CatalogController = ReturnType<typeof useCatalogController>
