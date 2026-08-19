import {
  confidentLyricHits,
  isCatalogNumberQuery,
  isLyricCatalogQuery,
  searchLyrics,
  type LyricSearchHit,
  type LyricSearchRow,
} from "@prabhat/core"

import type { SongSummary } from "@/lib/api"
import { isCompleteSargamQuery } from "@/lib/complete-sargam"
import type { ExploreSearchKind } from "@/lib/special-collections"
import { isCollectionSearchQuery } from "@/lib/special-collections"
import payload from "../../../data/generated/lyric_search_index.json"

export { isCatalogNumberQuery, isLyricCatalogQuery }

const THEME_CHIP_QUERIES = new Set([
  "love devotion",
  "peace bliss",
  "spiritual awakening",
  "service humanity",
  "nature river mountain",
])

const rows = (Array.isArray(payload) ? payload : []) as LyricSearchRow[]

export function catalogLyricCount() {
  return rows.length
}

export function searchCatalogLyrics(query: string, limit = 5): LyricSearchHit[] {
  if (!rows.length) return []
  return confidentLyricHits(searchLyrics(query, rows, limit))
}

export function lyricHitsToSongs(hits: LyricSearchHit[]): SongSummary[] {
  return hits.map((hit) => ({
    number: hit.number,
    title: hit.firstLine || hit.title,
    first_line: hit.snippet || hit.firstLine || hit.title,
    is_verified: true,
  }))
}

export function shouldSearchCatalogLyrics(query: string, _kind?: ExploreSearchKind) {
  const trimmed = query.trim()
  if (isCatalogNumberQuery(trimmed)) return false
  if (isCollectionSearchQuery(trimmed)) return false
  if (isCompleteSargamQuery(trimmed)) return false
  if (THEME_CHIP_QUERIES.has(trimmed.toLowerCase().replace(/\s+/g, " "))) return false
  return isLyricCatalogQuery(trimmed)
}
