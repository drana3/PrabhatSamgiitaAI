import AsyncStorage from "@react-native-async-storage/async-storage"
import type { SongSummary } from "@prabhat/core"

import { songCategories } from "@/constants/categories"
import type { MockSong } from "@/data/mock"
import { loadCatalog, readCatalogCache } from "@/lib/catalog"
import { songSummaryToMockSong } from "@/lib/songMap"
import precomputedCategories from "../../../data/generated/mobile_category_songs.json"

export type SongCategoryId = (typeof songCategories)[number]["id"]
export type FastSearchId = string

type PrecomputedSearch = {
  label: string
  song_numbers: number[]
  ui?: boolean
  collection_labels?: string[]
  curated_count?: number
  total_count?: number
}

type PrecomputedFile = {
  version: number
  ui_category_ids?: string[]
  categories?: Record<string, PrecomputedSearch>
  searches?: Record<string, PrecomputedSearch>
}

const PRECOMPUTED = precomputedCategories as PrecomputedFile
const CATEGORY_CACHE_KEY = "prabhat-category-songs-v3"

/** Theme/mood index for Songs-tab chips (+ devotion-style aliases). Catalog search is separate. */
const SEARCH_INDEX: Record<string, PrecomputedSearch> = {
  ...(PRECOMPUTED.categories ?? {}),
  ...(PRECOMPUTED.searches ?? {}),
}

const numbersBySearch = new Map<string, number[]>()
for (const [id, row] of Object.entries(SEARCH_INDEX)) {
  const numbers = Array.isArray(row?.song_numbers)
    ? row.song_numbers.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : []
  numbersBySearch.set(id, numbers)
}

const memorySongs = new Map<string, MockSong[]>()
let warmPromise: Promise<void> | null = null

/** Test helper — clears the in-memory theme-search warm cache. */
export function resetCategorySongsMemory() {
  memorySongs.clear()
  warmPromise = null
}

export function isSongCategoryId(value: string): value is SongCategoryId {
  return songCategories.some((row) => row.id === value)
}

export function isFastSearchId(value: string): boolean {
  return numbersBySearch.has(value)
}

export function categoryLabel(categoryId: SongCategoryId): string {
  return fastSearchLabel(categoryId)
}

export function fastSearchLabel(searchId: FastSearchId): string {
  return (
    SEARCH_INDEX[searchId]?.label ??
    songCategories.find((row) => row.id === searchId)?.label ??
    searchId
  )
}

/**
 * Theme/mood aliases → precomputed chip lists.
 * Do not add Hindi / Shiva / Spring / collection names here — those use catalog search.
 */
const THEME_QUERY_ALIASES: Record<string, FastSearchId> = {
  devotion: "devotional",
  devotional: "devotional",
  devotee: "devotional",
  devotees: "devotional",
  bhakti: "devotional",
  bhajan: "devotional",
  bhajans: "devotional",
  kirtan: "devotional",
  kirtans: "devotional",
  kiirtan: "devotional",
  kiirtana: "devotional",
  prayer: "devotional",
  prayers: "devotional",
  worship: "devotional",
  spiritual: "devotional",
  spirituality: "devotional",
  divine: "devotional",
  sacred: "devotional",
  holy: "devotional",
  praise: "devotional",
  hymn: "devotional",
  hymns: "devotional",
  surrender: "devotional",
  offering: "devotional",
  adoration: "devotional",
  reverence: "devotional",
  puja: "devotional",
  aarti: "devotional",
  arati: "devotional",
  sadhana: "devotional",
  prabhu: "devotional",
  ishta: "devotional",
  love: "love",
  loving: "love",
  nature: "nature",
  meditation: "meditation",
  meditate: "meditation",
  morning: "morning",
  dawn: "morning",
  evening: "evening",
  dusk: "evening",
  rain: "rain",
  rainy: "rain",
  monsoon: "rain",
  festival: "festival",
  festivals: "festival",
  guru: "guru",
  baba: "guru",
  peace: "peace",
  peaceful: "peace",
}

function normalizeThemeQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .replace(/^(?:songs?(?:\s+(?:of|for|about|on))?)\s+/, "")
    .replace(/\s+(?:songs?|music|bhajans?|kirtans?|kiirtans?)$/, "")
    .trim()
}

/** True for catalog intents that must never use theme precompute. */
export function isCatalogSearchQuery(query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return false
  if (/search prabhat samgiita for/i.test(trimmed)) return true
  if (/^\s*(?:ps[\s-]*)?\d{1,4}\s*$/i.test(trimmed)) return true
  return false
}

/**
 * Resolve theme/mood typed search to a precomputed chip list.
 * Returns null for catalog queries (lyrics, numbers, collection prompts).
 */
export function resolveCategoryQuery(query: string): FastSearchId | null {
  if (isCatalogSearchQuery(query)) return null

  const raw = query.trim().toLowerCase().replace(/\s+/g, " ")
  if (!raw) return null
  if (numbersBySearch.has(raw)) return raw
  const byUiLabel = songCategories.find((row) => row.label.toLowerCase() === raw)
  if (byUiLabel) return byUiLabel.id
  if (THEME_QUERY_ALIASES[raw]) return THEME_QUERY_ALIASES[raw]

  const key = normalizeThemeQuery(raw)
  if (!key || key === raw) return null
  if (numbersBySearch.has(key)) return key
  const byNormalizedUi = songCategories.find((row) => row.label.toLowerCase() === key)
  if (byNormalizedUi) return byNormalizedUi.id
  return THEME_QUERY_ALIASES[key] ?? null
}

export function songNumbersForCategory(searchId: FastSearchId): number[] {
  return numbersBySearch.get(searchId) ?? []
}

export function songsForCategoryFromCatalog(
  searchId: FastSearchId,
  catalog: SongSummary[],
): SongSummary[] {
  const wanted = songNumbersForCategory(searchId)
  if (!wanted.length || !catalog.length) return []
  const byNumber = new Map(catalog.map((row) => [row.number, row]))
  const ordered: SongSummary[] = []
  for (const number of wanted) {
    const row = byNumber.get(number)
    if (row) ordered.push(row)
  }
  return ordered
}

function toMockSongs(rows: SongSummary[]): MockSong[] {
  return rows.map((row, index) => songSummaryToMockSong(row, index))
}

function snapshotNumbers(): Record<string, number[]> {
  const out: Record<string, number[]> = {}
  for (const [id, numbers] of numbersBySearch) {
    out[id] = numbers
  }
  return out
}

async function persistCategoryIndex() {
  try {
    await AsyncStorage.setItem(
      CATEGORY_CACHE_KEY,
      JSON.stringify({
        version: PRECOMPUTED.version,
        searches: snapshotNumbers(),
        warmedAt: Date.now(),
      }),
    )
  } catch {
    /* ignore quota / storage failures */
  }
}

/** Warm in-memory lists for every precomputed theme search. */
export function prefetchCategorySongs(catalog: SongSummary[]) {
  if (!catalog.length) return
  for (const searchId of numbersBySearch.keys()) {
    memorySongs.set(searchId, toMockSongs(songsForCategoryFromCatalog(searchId, catalog)))
  }
  void persistCategoryIndex()
}

/**
 * Pre-warm theme lists from the local catalog cache.
 * Safe to call on app boot — does not touch live catalog search.
 */
export function warmCategorySongsCache(): Promise<void> {
  if (warmPromise) return warmPromise
  warmPromise = (async () => {
    const cached = await readCatalogCache()
    if (cached?.length) {
      prefetchCategorySongs(cached)
      return
    }
    const live = await loadCatalog()
    if (live.songs.length) prefetchCategorySongs(live.songs)
  })().catch(() => {
    warmPromise = null
  })
  return warmPromise
}

export type CategorySongsResult = {
  songs: MockSong[]
  label: string
  fromCache: boolean
}

/** Instant theme browse from precomputed song numbers × local song catalog cache. */
export async function loadCategorySongs(searchId: FastSearchId): Promise<CategorySongsResult> {
  const label = fastSearchLabel(searchId)
  const warm = memorySongs.get(searchId)
  if (warm?.length) {
    return { songs: warm, label, fromCache: true }
  }

  await warmCategorySongsCache()
  const afterWarm = memorySongs.get(searchId)
  if (afterWarm?.length) {
    return { songs: afterWarm, label, fromCache: true }
  }

  const cachedCatalog = await readCatalogCache()
  if (cachedCatalog?.length) {
    const songs = toMockSongs(songsForCategoryFromCatalog(searchId, cachedCatalog))
    if (songs.length) {
      memorySongs.set(searchId, songs)
      return { songs, label, fromCache: true }
    }
  }

  const live = await loadCatalog()
  const songs = toMockSongs(songsForCategoryFromCatalog(searchId, live.songs))
  if (songs.length) memorySongs.set(searchId, songs)
  return { songs, label, fromCache: live.fromCache }
}
