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
import { songSummaryToMockSong } from "@/lib/songMap"
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
  if (!chip) return undefined
  return allCollections.find((row) => row.label === chip.collectionLabel)
}

export function categoryLabel(categoryId: SongBrowseId): string {
  return fastSearchLabel(categoryId)
}

export function fastSearchLabel(searchId: FastSearchId): string {
  return (
    allBrowseChips.find((row) => row.id === searchId)?.label ??
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

export function seedCategoryForQuery(query: string): FastSearchId | null {
  const q = query.trim().toLowerCase()
  if (
    /\b(?:stress(?:ful|ed)?|anxiet(?:y|ies)|anxious|tense|tension|worried|overwhelm(?:ed)?)\b/.test(
      q,
    )
  ) {
    return "peace"
  }
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
  return song.title === `Song ${song.number}`
}

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
  const bundled = SEARCH_INDEX[searchId]?.songs
  if (Array.isArray(bundled) && bundled.length) {
    return overlayCatalogTitles(bundled, catalog)
  }
  const wanted = songNumbersForCategory(searchId)
  if (!wanted.length) return []
  const byNumber = new Map(catalog.map((row) => [row.number, row]))
  return wanted.map((number) => byNumber.get(number) ?? placeholderSummary(number))
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
