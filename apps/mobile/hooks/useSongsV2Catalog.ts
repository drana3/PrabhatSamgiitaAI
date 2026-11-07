import { useEffect } from "react"

import { MOCKUP_DATA } from "@/lib/mockupMode"
import { catalogEntries, ensureCatalog, useCatalogStore } from "@/lib/catalogStore"
import { usePreviewCatalog } from "@/lib/previewCatalog"
import { ensurePreviewCatalog } from "@/lib/previewCatalogLoader"

/**
 * The song catalog as CatalogEntry rows, shared by every screen (lib/catalogStore.ts): one cached
 * read, one request, one row-building pass. `loading` is true until the first rows (cached or
 * fresh) arrive, so a screen never shows an empty message while a request is still running.
 *
 * The web preview (MOCKUP_DATA) loads the same live catalog through lib/previewCatalog.ts, which
 * shares one load between screens and keeps a 7-song sample for when the API is unreachable
 * (`notice` says so).
 */
export function useSongsV2Catalog() {
  const real = useCatalogStore()
  const preview = usePreviewCatalog()

  useEffect(() => {
    void (MOCKUP_DATA ? ensurePreviewCatalog() : ensureCatalog())
  }, [])

  const source = MOCKUP_DATA ? preview.rows : real.rows
  const { entries, byNumber } = catalogEntries(source)

  return {
    entries,
    byNumber,
    loading: MOCKUP_DATA ? preview.loading : real.loading,
    refreshing: MOCKUP_DATA ? preview.refreshing : real.refreshing,
    error: MOCKUP_DATA ? null : real.error,
    /** Preview only: set while the 7 real songs stand in for the catalog. */
    notice: MOCKUP_DATA ? preview.notice : null,
    reload: () => (MOCKUP_DATA ? ensurePreviewCatalog(true) : ensureCatalog(true)),
  }
}
