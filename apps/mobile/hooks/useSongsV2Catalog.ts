import { useCallback, useEffect, useMemo, useState } from "react"

import { withFixtureStats } from "@/lib/fixtures/songs"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { loadCatalog, readCatalogCache } from "@/lib/catalog"
import { prefetchCategorySongs } from "@/lib/categorySongs"
import { hasPlayableAudio } from "@/lib/playableAudio"
import { usePreviewCatalog } from "@/lib/previewCatalog"
import { ensurePreviewCatalog } from "@/lib/previewCatalogLoader"
import { summaryToEntry, type CatalogEntry } from "@/lib/songsV2/entry"
import type { SongSummary } from "@prabhat/core"

/**
 * The song catalog as CatalogEntry rows: cache first, then the network.
 * `loading` is true until the first rows (cached or fresh) arrive, so the
 * screen never shows an empty message while a request is still running.
 *
 * The web preview (MOCKUP_DATA) loads the same live catalog through lib/previewCatalog.ts, which
 * shares one load between screens and keeps a 7-song sample for when the API is unreachable
 * (`notice` says so).
 */
export function useSongsV2Catalog() {
  const [rows, setRows] = useState<SongSummary[]>([])
  const [loading, setLoading] = useState(!MOCKUP_DATA)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preview = usePreviewCatalog()

  const load = useCallback(async () => {
    if (MOCKUP_DATA) {
      await ensurePreviewCatalog(true)
      return
    }
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
    if (MOCKUP_DATA) {
      void ensurePreviewCatalog()
      return
    }
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

  const source = MOCKUP_DATA ? preview.rows : rows
  const entries = useMemo<CatalogEntry[]>(
    () => source.map((row) => withFixtureStats(summaryToEntry(row, { hasAudio: hasPlayableAudio }))),
    [source],
  )
  const byNumber = useMemo(() => new Map(entries.map((e) => [e.number, e])), [entries])

  return {
    entries,
    byNumber,
    loading: MOCKUP_DATA ? preview.loading : loading,
    refreshing: MOCKUP_DATA ? preview.refreshing : refreshing,
    error: MOCKUP_DATA ? null : error,
    /** Preview only: set while the 7 real songs stand in for the catalog. */
    notice: MOCKUP_DATA ? preview.notice : null,
    reload: load,
  }
}
