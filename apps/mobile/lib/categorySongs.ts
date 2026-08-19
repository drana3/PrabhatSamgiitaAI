import AsyncStorage from "@react-native-async-storage/async-storage"
import type { SongSummary } from "@prabhat/core"

import {
  songCategories,
  songCollectionChips,
  type SongBrowseId,
  type SongCategoryId,
} from "@/constants/categories"
import type { MockSong } from "@/data/mock"
import { allCollections, collectionSearchPrompt, type CollectionItem } from "@/data/collections"
import { readCatalogCache } from "@/lib/catalog"
import { isNaturalLanguageSearch } from "@/lib/searchMode"
import { songSummaryToMockSong } from "@/lib/songMap"
import collectionSongTitles from "../../../data/generated/collection_song_titles.json"
import precomputedCategories from "../../../data/generated/mobile_category_songs.json"

export type { SongBrowseId, SongCategoryId }
export type FastSearchId = string

type PrecomputedSearch = {
  label: string
  song_numbers: number[]
  songs?: SongSummary[]
  ui?: boolean
  collection_labels?: string[]
}

type PrecomputedFile = {
  version: number
  categories?: Record<string, PrecomputedSearch>
  searches?: Record<string, PrecomputedSearch>
}

const PRECOMPUTED = precomputedCategories as PrecomputedFile
const REMEMBER_KEY = "prabhat-browse-chip-results-v1"

const SEARCH_INDEX: Record<string, PrecomputedSearch> = {
  ...(PRECOMPUTED.categories ?? {}),
  ...(PRECOMPUTED.searches ?? {}),
}

type CollectionTitleRow = { title?: string; first_line?: string | null }
const COLLECTION_TITLES = collectionSongTitles as Record<string, CollectionTitleRow>

function bundledTitleIndex(): Map<number, SongSummary> {
  const map = new Map<number, SongSummary>()
  for (const entry of Object.values(SEARCH_INDEX)) {
    for (const song of entry.songs ?? []) {
      map.set(song.number, song)
    }
  }
  for (const [raw, row] of Object.entries(COLLECTION_TITLES)) {
    const number = Number(raw)
    if (!Number.isFinite(number) || number < 1 || map.has(number)) continue
    map.set(number, {
      number,
      title: row.title || row.first_line || `Song ${number}`,
      first_line: row.first_line ?? null,
      is_verified: true,
    })
  }
  return map
}

const BUNDLED_TITLES = bundledTitleIndex()

const allBrowseChips = [...songCategories, ...songCollectionChips]

const memorySongs = new Map<string, MockSong[]>()
let warmPromise: Promise<void> | null = null

/** Test helper — clears the in-memory browse-chip cache. */
export function resetCategorySongsMemory() {
  memorySongs.clear()
  warmPromise = null
}

export function isSongCategoryId(value: string): value is SongBrowseId {
  return allBrowseChips.some((row) => row.id === value)
}

export function isMoodCategoryId(value: string): value is SongCategoryId {
  return songCategories.some((row) => row.id === value)
}

export function isFastSearchId(value: string): boolean {
  return isSongCategoryId(value) || Boolean(SEARCH_INDEX[value])
}

export function collectionForCategory(searchId: FastSearchId): CollectionItem | undefined {
  const chip = songCollectionChips.find((row) => row.id === searchId)
  if (chip) return allCollections.find((row) => row.label === chip.collectionLabel)
  const lowered = searchId.trim().toLowerCase()
  return allCollections.find(
    (row) => row.label.toLowerCase() === lowered || row.value.toLowerCase() === lowered,
  )
}

export function collectionFromQuery(query: string): CollectionItem | undefined {
  const trimmed = query.trim()
  if (!trimmed) return undefined
  const prompt = /^search prabhat samgiita for\s+(.+)$/i.exec(trimmed)
  return collectionForCategory(prompt?.[1]?.trim() || trimmed)
}

export function categoryLabel(categoryId: SongBrowseId): string {
  return fastSearchLabel(categoryId)
}

export function fastSearchLabel(searchId: FastSearchId): string {
  return (
    allBrowseChips.find((row) => row.id === searchId)?.label ??
    collectionForCategory(searchId)?.label ??
    SEARCH_INDEX[searchId]?.label ??
    searchId
  )
}

export function categoryCollectionPrompt(searchId: FastSearchId): string | null {
  const collection = collectionForCategory(searchId)
  return collection ? collectionSearchPrompt(collection.label) : null
}

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
  guruji: "guru",
  gurudev: "guru",
  sadguru: "guru",
  preceptor: "guru",
  peace: "peace",
  peaceful: "peace",
  hindi: "hindi",
  urdu: "urdu",
  english: "english",
  sanskrit: "sanskrit",
  shiva: "shiva",
  krsna: "krsna",
  krishna: "krsna",
  spring: "spring",
  children: "children",
  kids: "children",
  child: "children",
  neohumanism: "neohumanism",
  "neo-humanism": "neohumanism",
  "neo humanism": "neohumanism",
}

function normalizeThemeQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/ś/g, "s")
    .replace(/ń/g, "n")
    .replace(/\s+/g, " ")
    .replace(/^(?:songs?(?:\s+(?:of|for|about|on))?)\s+/, "")
    .replace(/\s+(?:songs?|music|bhajans?|kirtans?|kiirtans?)$/, "")
    .trim()
}

export function isCatalogSearchQuery(query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return false
  if (/search prabhat samgiita for/i.test(trimmed)) return true
  if (/^\s*(?:ps[\s-]*)?\d{1,4}\s*$/i.test(trimmed)) return true
  return false
}

export function resolveCategoryQuery(query: string): FastSearchId | null {
  if (/^\s*(?:ps[\s-]*)?\d{1,4}\s*$/i.test(query)) return null
  if (isNaturalLanguageSearch(query)) return null

  const collection = collectionFromQuery(query)
  if (collection) {
    const chip = songCollectionChips.find((row) => row.collectionLabel === collection.label)
    return chip?.id ?? collection.label
  }

  if (isCatalogSearchQuery(query)) return null

  const raw = query.trim().toLowerCase().replace(/\s+/g, " ")
  if (!raw) return null
  const byUiLabel = allBrowseChips.find((row) => row.label.toLowerCase() === raw)
  if (byUiLabel) return byUiLabel.id
  if (THEME_QUERY_ALIASES[raw]) return THEME_QUERY_ALIASES[raw]
  if (SEARCH_INDEX[raw]) return raw

  const key = normalizeThemeQuery(raw)
  if (!key) return null
  const byNormalizedUi = allBrowseChips.find((row) => normalizeThemeQuery(row.label) === key)
  if (byNormalizedUi) return byNormalizedUi.id
  if (THEME_QUERY_ALIASES[key]) return THEME_QUERY_ALIASES[key]
  return SEARCH_INDEX[key] ? key : null
}

/** Keep the collection/mood header when the query is that same browse path. */
export function queryMatchesBrowseCategory(query: string, categoryId: string) {
  if (!categoryId) return false
  if (resolveCategoryQuery(query) === categoryId) return true
  return query.trim().toLowerCase() === fastSearchLabel(categoryId).toLowerCase()
}

/** Stable list heading so collection taps do not flash “Songs · N”. */
export function browseResultsHeading(
  query: string,
  resultCount: number,
  activeCategory?: string | null,
) {
  const browseId = resolveCategoryQuery(query) ?? activeCategory ?? null
  const collection =
    collectionFromQuery(query) ?? (browseId ? collectionForCategory(browseId) : undefined)
  const label = browseId ? categoryLabel(browseId) : null
  const count = collection?.count ?? resultCount
  if (label) return count > 0 ? `${label} · ${count}` : label
  return count > 0 ? `Songs · ${count}` : "Songs"
}

/** Only exact chip-style queries. Feeling sentences stay on semantic search. */
export function seedCategoryForQuery(query: string): FastSearchId | null {
  return resolveCategoryQuery(query)
}

export function semanticQueryForCategory(searchId: FastSearchId, spokenQuery?: string): string {
  const spoken = spokenQuery?.trim() ?? ""
  const themed: Record<string, string> = {
    guru: "songs about guru Baba teacher sadguru",
    peace: "songs for peace calm relief from stress",
    devotional: "devotional bhakti songs",
    meditation: "meditation quiet mind",
    love: "songs of divine love",
    nature: "songs of nature",
    morning: "morning dawn songs",
    evening: "evening dusk sunset twilight songs",
    rain: "rain monsoon songs",
    festival: "festival celebration songs",
  }
  const collection = collectionForCategory(searchId)
  const base = themed[searchId]
    ?? (collection ? `${collection.value} songs` : `${fastSearchLabel(searchId)} songs`)
  const label = fastSearchLabel(searchId)
  if (spoken && spoken.toLowerCase() !== label.toLowerCase() && spoken.toLowerCase() !== searchId) {
    return `${spoken} ${base}`
  }
  return base
}

function isPlaceholderTitle(song: MockSong): boolean {
  return !song.title || song.title === `Song ${song.number}` || song.title === String(song.number)
}

export const CATEGORY_RESULT_LIMIT = 10
export const SEMANTIC_RESULT_LIMIT = 5
export const CATALOG_RESULT_LIMIT = 10

export function mergeSongs(primary: MockSong[], extra: MockSong[]): MockSong[] {
  const extraByKey = new Map(extra.map((song) => [String(song.number || song.id), song]))
  const seen = new Set<string>()
  const out: MockSong[] = []
  for (const song of primary) {
    const key = String(song.number || song.id)
    if (seen.has(key)) continue
    seen.add(key)
    const richer = extraByKey.get(key)
    out.push(richer && isPlaceholderTitle(song) ? richer : song)
  }
  for (const song of extra) {
    const key = String(song.number || song.id)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(song)
  }
  return out
}

/** Fill missing titles without adding songs that are not in the collection. */
export function overlaySongTitles(primary: MockSong[], extra: MockSong[]): MockSong[] {
  const extraByKey = new Map(extra.map((song) => [String(song.number || song.id), song]))
  return primary.map((song) => {
    const key = String(song.number || song.id)
    const richer = extraByKey.get(key)
    return richer && isPlaceholderTitle(song) ? richer : song
  })
}

/** Chip / typed category: 10 curated songs. Semantic only fills if the list is short. */
export function composeCategoryResults(curated: MockSong[], semantic: MockSong[] = []): MockSong[] {
  const top = curated.slice(0, CATEGORY_RESULT_LIMIT)
  if (top.length >= CATEGORY_RESULT_LIMIT) return top
  return mergeSongs(top, semantic).slice(0, CATEGORY_RESULT_LIMIT)
}

/** Mood chips stay at 10. Named collections keep every listed song. */
export function composeBrowseResults(
  searchId: FastSearchId,
  curated: MockSong[],
  extra: MockSong[] = [],
): MockSong[] {
  if (isMoodCategoryId(searchId)) return composeCategoryResults(curated, extra)
  return overlaySongTitles(curated, extra)
}

export function limitSearchResults(songs: MockSong[], mode: "catalog" | "semantic"): MockSong[] {
  const limit = mode === "semantic" ? SEMANTIC_RESULT_LIMIT : CATALOG_RESULT_LIMIT
  return songs.slice(0, limit)
}

function bundledNumbers(searchId: FastSearchId): number[] {
  const numbers = SEARCH_INDEX[searchId]?.song_numbers
  if (!Array.isArray(numbers)) return []
  return numbers.map(Number).filter((n) => Number.isFinite(n) && n > 0)
}

export function songNumbersForCategory(searchId: FastSearchId): number[] {
  const fromCollection = collectionForCategory(searchId)?.songNumbers
  if (fromCollection?.length) return fromCollection
  return bundledNumbers(searchId)
}

function placeholderSummary(number: number): SongSummary {
  const bundled = BUNDLED_TITLES.get(number)
  if (bundled) return bundled
  return {
    number,
    title: `Song ${number}`,
    first_line: null,
    is_verified: true,
  }
}

function toMockSongs(rows: SongSummary[]): MockSong[] {
  return rows.map((row, index) => songSummaryToMockSong(row, index))
}

function overlayCatalogTitles(rows: SongSummary[], catalog: SongSummary[]): SongSummary[] {
  if (!catalog.length) return rows
  const byNumber = new Map(catalog.map((row) => [row.number, row]))
  return rows.map((row) => byNumber.get(row.number) ?? row)
}

export function songsForCategoryFromCatalog(
  searchId: FastSearchId,
  catalog: SongSummary[],
): SongSummary[] {
  const byNumber = new Map(catalog.map((row) => [row.number, row]))
  if (isMoodCategoryId(searchId)) {
    const bundled = SEARCH_INDEX[searchId]?.songs
    if (Array.isArray(bundled) && bundled.length) {
      return overlayCatalogTitles(bundled, catalog)
    }
  }
  const wanted = songNumbersForCategory(searchId)
  if (!wanted.length) {
    const bundled = SEARCH_INDEX[searchId]?.songs
    if (Array.isArray(bundled) && bundled.length) {
      return overlayCatalogTitles(bundled, catalog)
    }
    return []
  }
  return wanted.map(
    (number) => byNumber.get(number) ?? BUNDLED_TITLES.get(number) ?? placeholderSummary(number),
  )
}

function snapshotRemembered(): Record<string, SongSummary[]> {
  const out: Record<string, SongSummary[]> = {}
  for (const [id, songs] of memorySongs) {
    if (!songs.length) continue
    out[id] = songs.map((song) => ({
      number: song.number,
      title: song.title,
      first_line: song.originalTitle ?? null,
      is_verified: true,
    }))
  }
  return out
}

async function persistRemembered() {
  try {
    await AsyncStorage.setItem(REMEMBER_KEY, JSON.stringify(snapshotRemembered()))
  } catch {
    /* ignore quota / storage failures */
  }
}

/** Cache a non-empty chip result. Never cache generic/voice search. Never cache []. */
export function rememberCategorySongs(searchId: FastSearchId, songs: MockSong[]) {
  if (!songs.length) return
  const bundled = songsForCategoryFromCatalog(searchId, [])
  if (bundled.length > songs.length) {
    memorySongs.set(searchId, toMockSongs(bundled))
    return
  }
  memorySongs.set(searchId, songs)
  void persistRemembered()
}

function seedFromBundled(searchId: FastSearchId, catalog: SongSummary[] = []) {
  const rows = songsForCategoryFromCatalog(searchId, catalog)
  if (!rows.length) return
  const current = memorySongs.get(searchId)
  if (current && current.length >= rows.length) return
  memorySongs.set(searchId, toMockSongs(rows))
}

/** Overlay live titles onto bundled/collection lists. Never shrink a prepopulated list. */
export function prefetchCategorySongs(catalog: SongSummary[]) {
  for (const chip of allBrowseChips) {
    seedFromBundled(chip.id, catalog)
  }
  for (const collection of allCollections) {
    const chip = songCollectionChips.find((row) => row.collectionLabel === collection.label)
    seedFromBundled(chip?.id ?? collection.label, catalog)
  }
  for (const searchId of Object.keys(SEARCH_INDEX)) {
    seedFromBundled(searchId, catalog)
  }
  void persistRemembered()
}

export function warmCategorySongsCache(): Promise<void> {
  if (warmPromise) return warmPromise
  warmPromise = (async () => {
    for (const chip of allBrowseChips) {
      seedFromBundled(chip.id)
    }
    try {
      const stored = await AsyncStorage.getItem(REMEMBER_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, SongSummary[]>
        for (const [id, rows] of Object.entries(parsed)) {
          if (!Array.isArray(rows) || !rows.length) continue
          const bundled = songsForCategoryFromCatalog(id, [])
          if (bundled.length && bundled.length > rows.length) continue
          memorySongs.set(id, toMockSongs(rows))
        }
      }
    } catch {
      /* ignore corrupt cache */
    }
    const cached = await readCatalogCache()
    if (cached?.length) prefetchCategorySongs(cached)
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

/** Instant browse from bundled mood lists or verified collection numbers. */
export async function loadCategorySongs(searchId: FastSearchId): Promise<CategorySongsResult> {
  const label = fastSearchLabel(searchId)
  seedFromBundled(searchId)
  const local = memorySongs.get(searchId)
  if (local?.length) {
    return { songs: local, label, fromCache: true }
  }

  await warmCategorySongsCache()
  const afterWarm = memorySongs.get(searchId)
  if (afterWarm?.length) {
    return { songs: afterWarm, label, fromCache: true }
  }

  const cachedCatalog = (await readCatalogCache()) ?? []
  const songs = toMockSongs(songsForCategoryFromCatalog(searchId, cachedCatalog))
  if (songs.length) memorySongs.set(searchId, songs)
  return { songs, label, fromCache: true }
}
