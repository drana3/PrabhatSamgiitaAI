import { useCallback, useEffect, useMemo, useState } from "react"

import { withFixtureStats } from "@/lib/fixtures/songs"
import { mockEntries } from "@/lib/fixtures/songsMock"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { loadCatalog, readCatalogCache } from "@/lib/catalog"
import { prefetchCategorySongs } from "@/lib/categorySongs"
import { hasPlayableAudio } from "@/lib/playableAudio"
import { summaryToEntry, type CatalogEntry } from "@/lib/songsV2/entry"
import type { SongSummary } from "@prabhat/core"

/**
 * The song catalog as CatalogEntry rows: cache first, then the network.
 * `loading` is true until the first rows (cached or fresh) arrive, so the
 * screen never shows an empty message while a request is still running.
 */
export function useSongsV2Catalog() {
  const [rows, setRows] = useState<SongSummary[]>([])
  const [loading, setLoading] = useState(!MOCKUP_DATA)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setRefreshing(true)
    const result = await loadCatalog()
    if (result.songs.length) {
      setRows(result.songs)
      prefetchCategorySongs(result.songs)
    }
    setError(result.error)
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    // Preview: the prototype sample, no network.
    if (MOCKUP_DATA) return
    let active = true
    void (async () => {
      const cached = await readCatalogCache()
      if (!active) return
      if (cached?.length) {
        setRows(cached)
        prefetchCategorySongs(cached)
        setLoading(false)
      }
      await load()
    })()
    return () => {
      active = false
    }
  }, [load])

  const entries = useMemo<CatalogEntry[]>(
    () => (MOCKUP_DATA ? mockEntries() : rows.map((row) => withFixtureStats(summaryToEntry(row, { hasAudio: hasPlayableAudio })))),
    [rows],
  )
  const byNumber = useMemo(() => new Map(entries.map((e) => [e.number, e])), [entries])

  return { entries, byNumber, loading, refreshing, error, reload: load }
}
