import {
  confidentLyricHits,
  interpretLyricHits,
  isCatalogNumberQuery,
  isLyricCatalogQuery,
  isNaturalLanguageSearch,
  normalizeLyricText,
  planSearch,
  searchLyrics,
  stripCatalogSearchFraming,
  type FeelingMoodId,
  type LyricSearchHit,
  type LyricSearchRow,
  type SearchAuth,
} from "@prabhat/core"

import type { SongSummary } from "@/lib/api"
import { isCompleteSargamQuery } from "@/lib/complete-sargam"
import type { ExploreSearchKind } from "@/lib/special-collections"
import { collectionSongNumbersForKeyword, isCollectionSearchQuery } from "@/lib/special-collections"
import payload from "../../../data/generated/lyric_search_index.json"
import moodCatalog from "../../../data/generated/mobile_category_songs.json"

export { isCatalogNumberQuery, isLyricCatalogQuery }

const THEME_CHIP_MOOD: Record<string, FeelingMoodId | "love" | "nature"> = {
  "love devotion": "love",
  "peace bliss": "peace",
  "spiritual awakening": "meditation",
  "service humanity": "devotional",
  "nature river mountain": "nature",
}

type MoodCatalogFile = {
  categories?: Record<string, { song_numbers?: number[] }>
}

const rows = (Array.isArray(payload) ? payload : []) as LyricSearchRow[]
const rowsByNumber = new Map(rows.map((row) => [row.n, row]))
const moodCategories = (moodCatalog as MoodCatalogFile).categories ?? {}

export function catalogLyricCount() {
  return rows.length
}

function rowToSong(row: LyricSearchRow): SongSummary {
  return {
    number: row.n,
    title: row.t,
    first_line: row.o,
    is_verified: true,
  }
}

export function searchCatalogLyrics(
  query: string,
  limit = 5,
  options?: { interpret?: boolean },
): LyricSearchHit[] {
  if (!rows.length) return []
  const pick = (value: string) => {
    const hits = searchLyrics(value, rows, limit)
    return options?.interpret ? interpretLyricHits(hits) : confidentLyricHits(hits)
  }
  const primary = pick(query)
  if (primary.length) return primary
  const stripped = stripCatalogSearchFraming(query)
  if (stripped && stripped !== normalizeLyricText(query)) return pick(stripped)
  return []
}

export function lyricHitsToSongs(hits: LyricSearchHit[]): SongSummary[] {
  return hits.map((hit) => ({
    number: hit.number,
    title: hit.title || hit.firstLine,
    first_line: hit.snippet || hit.firstLine || hit.title,
    is_verified: true,
  }))
}

export function catalogSongByNumber(query: string): SongSummary | null {
  if (!isCatalogNumberQuery(query)) return null
  const number = Number.parseInt(query.replace(/\D+/g, ""), 10)
  const row = rowsByNumber.get(number)
  return row ? rowToSong(row) : null
}

export function songsByNumbers(numbers: number[]): SongSummary[] {
  return numbers.map((number) => {
    const row = rowsByNumber.get(number)
    return row
      ? rowToSong(row)
      : { number, title: `Prabhat Samgiita ${number}`, is_verified: false }
  })
}

export function songsFromMoodList(moodId: string, limit = 10): SongSummary[] {
  const numbers = moodCategories[moodId]?.song_numbers ?? []
  return numbers.slice(0, limit).flatMap((number) => {
    const row = rowsByNumber.get(number)
    return row ? [rowToSong(row)] : []
  })
}

export function shouldSearchCatalogLyrics(query: string, _kind?: ExploreSearchKind) {
  if (process.env.NEXT_PUBLIC_E2E_DISABLE_SEARCH_PREFETCH === "true") return false
  const trimmed = query.trim()
  if (isCatalogNumberQuery(trimmed)) return false
  if (isCollectionSearchQuery(trimmed)) return false
  if (isCompleteSargamQuery(trimmed)) return false
  if (THEME_CHIP_MOOD[trimmed.toLowerCase().replace(/\s+/g, " ")]) return false
  if (isNaturalLanguageSearch(trimmed)) return false
  return isLyricCatalogQuery(trimmed)
}

function songsFromCollection(query: string): SongSummary[] | null {
  const collectionNumbers = collectionSongNumbersForKeyword(query)
  if (!collectionNumbers?.length) return null
  return collectionNumbers.slice(0, 5).flatMap((number) => {
    const row = rowsByNumber.get(number)
    return row ? [rowToSong(row)] : []
  })
}

const DEFAULT_AUTH: SearchAuth = { signedIn: false, feelingSearchEnabled: false }

/** Local catalog hits with no API wait. `null` means fall through to network search. */
export function instantExploreSongs(
  query: string,
  _kind?: ExploreSearchKind,
  auth: SearchAuth = DEFAULT_AUTH,
): SongSummary[] | null {
  if (process.env.NEXT_PUBLIC_E2E_DISABLE_SEARCH_PREFETCH === "true") return null
  const trimmed = query.trim()
  if (!trimmed) return null
  if (isCompleteSargamQuery(trimmed)) return null

  const numbered = catalogSongByNumber(trimmed)
  if (numbered) return [numbered]
  if (isCatalogNumberQuery(trimmed)) return []

  const chipId = THEME_CHIP_MOOD[trimmed.toLowerCase().replace(/\s+/g, " ")]
  if (chipId) {
    const chipSongs = songsFromMoodList(chipId)
    return chipSongs.length ? chipSongs : []
  }

  const plan = planSearch(trimmed, auth)
  if (plan.layer === "mood" && plan.moodId) {
    const moodSongs = songsFromMoodList(plan.moodId)
    return moodSongs.length ? moodSongs : []
  }
  if (plan.layer === "semantic") return null

  const collection = songsFromCollection(trimmed)
  if (collection?.length) return collection
  const hits = searchCatalogLyrics(trimmed, 5, { interpret: true })
  if (hits.length) return lyricHitsToSongs(hits)
  return []
}
