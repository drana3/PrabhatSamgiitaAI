import AsyncStorage from "@react-native-async-storage/async-storage"
import type { SongSummary } from "@prabhat/core"

import { api } from "@/lib/client"

const CATALOG_CACHE_KEY = "prabhat-catalog-songs-v1"
export const CATALOG_PAGE_SIZE = 40

export type CatalogLoadResult = {
  songs: SongSummary[]
  fromCache: boolean
  error: string | null
}

/** The parsed catalog stays in memory: 5,018 rows are read and JSON-parsed once per app run, not per screen. */
let memoryRows: SongSummary[] | null = null
/** One live request at a time, shared by every screen that asks. */
let inflight: Promise<CatalogLoadResult> | null = null
let freshAt = 0
/** A live catalog younger than this is reused instead of fetched again (tab switches, remounts). */
export const CATALOG_FRESH_MS = 60_000

/** Forget everything held in memory (tests, sign-out). The AsyncStorage copy is untouched. */
export function resetCatalogMemory() {
  memoryRows = null
  inflight = null
  freshAt = 0
}

export async function readCatalogCache(): Promise<SongSummary[] | null> {
  if (memoryRows?.length) return memoryRows
  try {
    const raw = await AsyncStorage.getItem(CATALOG_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || !parsed.length) return null
    memoryRows = parsed as SongSummary[]
    return memoryRows
  } catch {
    return null
  }
}

async function writeCache(songs: SongSummary[]) {
  memoryRows = songs
  try {
    await AsyncStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(songs))
  } catch {
    /* ignore quota / storage failures */
  }
}

/**
 * Fetch live catalog and refresh AsyncStorage cache. Falls back to cache on failure.
 * Callers share one request; a live result under CATALOG_FRESH_MS old is reused unless `force`.
 */
export function loadCatalog(options: { force?: boolean } = {}): Promise<CatalogLoadResult> {
  if (inflight) return inflight
  if (!options.force && memoryRows?.length && Date.now() - freshAt < CATALOG_FRESH_MS) {
    return Promise.resolve({ songs: memoryRows, fromCache: false, error: null })
  }
  inflight = fetchCatalog().finally(() => {
    inflight = null
  })
  return inflight
}

async function fetchCatalog(): Promise<CatalogLoadResult> {
  const cached = await readCatalogCache()

  try {
    const songs = await api.fetchSongs()
    if (songs.length) {
      freshAt = Date.now()
      void writeCache(songs)
      return { songs, fromCache: false, error: null }
    }
    if (cached?.length) {
      // Keep serving saved catalog quietly — no scare banner on the home screen.
      return { songs: cached, fromCache: true, error: null }
    }
    return {
      songs: [],
      fromCache: false,
      error: "Could not load the song catalog. Check your connection and try again.",
    }
  } catch {
    if (cached?.length) {
      return { songs: cached, fromCache: true, error: null }
    }
    return {
      songs: [],
      fromCache: false,
      error: "Could not load the song catalog. Check your connection and try again.",
    }
  }
}

export function pageSongs<T>(songs: T[], page: number, pageSize = CATALOG_PAGE_SIZE): T[] {
  const safePage = Math.max(1, page)
  return songs.slice(0, safePage * pageSize)
}
