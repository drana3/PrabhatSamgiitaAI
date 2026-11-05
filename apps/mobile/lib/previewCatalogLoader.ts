import { loadCatalog, readCatalogCache } from "@/lib/catalog"
import { prefetchCategorySongs } from "@/lib/categorySongs"
import { REAL_SONGS_1_TO_7 } from "@/lib/fixtures/realSongs"
import { resolvePreviewRows, usePreviewCatalog } from "@/lib/previewCatalog"

/** Fills lib/previewCatalog.ts from the same code the real build uses (cache, then loadCatalog). */

let pending: Promise<void> | null = null

/**
 * Loads the catalog once and shares it. A second call while a load runs gets the same promise;
 * after a successful live load it does nothing unless `force` is set (pull to refresh, Try again).
 */
export function ensurePreviewCatalog(force = false): Promise<void> {
  const state = usePreviewCatalog.getState()
  if (pending) return pending
  if (!force && state.source === "api") return Promise.resolve()
  pending = (async () => {
    usePreviewCatalog.setState({ refreshing: true })
    // Cache first (instant on a revisit), the way the real build starts.
    if (!usePreviewCatalog.getState().rows.length) {
      const cached = await readCatalogCache()
      if (cached?.length) {
        usePreviewCatalog.setState({ rows: cached, source: "cache", notice: null, loading: false })
        prefetchCategorySongs(cached)
      }
    }
    const result = await loadCatalog({ force })
    const next = resolvePreviewRows(result)
    // A failed refresh must not replace rows that are already on screen with the 7-song sample.
    const keep = next.source === "fallback" && usePreviewCatalog.getState().rows.length > REAL_SONGS_1_TO_7.length
    if (!keep) usePreviewCatalog.setState({ ...next, loading: false })
    else usePreviewCatalog.setState({ loading: false })
    if (next.source !== "fallback") prefetchCategorySongs(next.rows)
  })()
    .catch(() => {
      if (!usePreviewCatalog.getState().rows.length) {
        usePreviewCatalog.setState({ ...resolvePreviewRows({ songs: [], fromCache: false }), loading: false })
      }
    })
    .finally(() => {
      usePreviewCatalog.setState({ refreshing: false, loading: false })
      pending = null
    })
  return pending
}
