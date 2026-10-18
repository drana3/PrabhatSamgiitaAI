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

export async function readCatalogCache(): Promise<SongSummary[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CATALOG_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || !parsed.length) return null
    return parsed as SongSummary[]
  } catch {
    return null
  }
}

async function writeCache(songs: SongSummary[]) {
  try {
    await AsyncStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(songs))
  } catch {
    /* ignore quota / storage failures */
  }
}

/** Fetch live catalog and refresh AsyncStorage cache. Falls back to cache on failure. */
export async function loadCatalog(): Promise<CatalogLoadResult> {
  const cached = await readCatalogCache()

  try {
    const songs = await api.fetchSongs()
    if (songs.length) {
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
