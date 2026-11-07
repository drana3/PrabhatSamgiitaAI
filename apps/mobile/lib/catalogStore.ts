import type { SongSummary } from "@prabhat/core"
import { create } from "zustand"

import { loadCatalog, readCatalogCache } from "@/lib/catalog"
import { prefetchCategorySongs } from "@/lib/categorySongs"
import { hasPlayableAudio } from "@/lib/playableAudio"
import { withFixtureStats } from "@/lib/fixtures/songs"
import { summaryToEntry, type CatalogEntry } from "@/lib/songsV2/entry"

/**
 * One shared catalog of the real build: the 5,018 songs are read from the cache, fetched and turned
 * into rows once, however many screens (Songs, Search, Learn picker, Today, playlists) ask.
 * Screens read it through hooks/useSongsV2Catalog.ts. The web preview keeps lib/previewCatalog.ts,
 * which fills itself through the same lib/catalog.ts loader.
 *
 * First paint stays fast: the saved copy is put into the store before the network answers.
 */

type CatalogState = {
  rows: SongSummary[]
  /** true until the first rows (saved or fresh) have arrived */
  loading: boolean
  refreshing: boolean
  error: string | null
  /** true once a live load has finished successfully in this app run */
  live: boolean
}

export const useCatalogStore = create<CatalogState>(() => ({
  rows: [],
  loading: true,
  refreshing: false,
  error: null,
  live: false,
}))

let pending: Promise<void> | null = null

/**
 * Loads the catalog once and shares it. A call while a load runs gets the same promise; after a
 * live load it does nothing unless `force` is set (pull to refresh, Try again).
 */
export function ensureCatalog(force = false): Promise<void> {
  if (pending) return pending
  if (!force && useCatalogStore.getState().live) return Promise.resolve()
  pending = (async () => {
    useCatalogStore.setState({ refreshing: true })
    if (!useCatalogStore.getState().rows.length) {
      const cached = await readCatalogCache()
      if (cached?.length) {
        useCatalogStore.setState({ rows: cached, loading: false })
        prefetchCategorySongs(cached)
      }
    }
    const result = await loadCatalog({ force })
    if (result.songs.length) {
      const changed = useCatalogStore.getState().rows !== result.songs
      useCatalogStore.setState({ ...(changed ? { rows: result.songs } : {}), live: !result.fromCache || useCatalogStore.getState().live })
      if (changed) prefetchCategorySongs(result.songs)
    }
    useCatalogStore.setState({ error: result.error })
  })()
    .catch(() => undefined)
    .finally(() => {
      useCatalogStore.setState({ refreshing: false, loading: false })
      pending = null
    })
  return pending
}

/** Rows of the catalog, built once per catalog array and shared by every screen. */
let entriesFor: SongSummary[] | null = null
let entriesCache: { entries: CatalogEntry[]; byNumber: Map<number, CatalogEntry> } = { entries: [], byNumber: new Map() }

export function catalogEntries(source: SongSummary[]) {
  if (source !== entriesFor) {
    const entries = source.map((row) => withFixtureStats(summaryToEntry(row, { hasAudio: hasPlayableAudio })))
    entriesFor = source
    entriesCache = { entries, byNumber: new Map(entries.map((e) => [e.number, e])) }
  }
  return entriesCache
}

/** Test and sign-out helper. */
export function resetCatalogStore() {
  pending = null
  entriesFor = null
  entriesCache = { entries: [], byNumber: new Map() }
  useCatalogStore.setState({ rows: [], loading: true, refreshing: false, error: null, live: false })
}
