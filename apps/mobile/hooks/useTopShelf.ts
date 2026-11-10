import { useEffect, useMemo, useState } from "react"

import { topPlayedApi } from "@/lib/topPlayed/api"
import type { TopKind } from "@/lib/topPlayed/model"
import { createShelfCache, loadShelfKind, shelfRows, shelfVisible } from "@/lib/topPlayed/shelf"
import type { TopItem, TopPlayedApi } from "@/lib/topPlayed/types"
import { useKirtanStore } from "@/stores/kirtanStore"

const cache = createShelfCache()

/**
 * Drives the "Most played" shelf of Today: asks for the "All" list once (so the shelf knows whether it has the five rows it
 * needs) and for a kind when its chip is tapped. While loading or when the server cannot be reached the shelf stays hidden:
 * Today never shows an error for a shelf that is only an extra.
 */
export function useTopShelf(api: TopPlayedApi = topPlayedApi()) {
  const [kind, setKind] = useState<TopKind>("all")
  const [loaded, setLoaded] = useState<Partial<Record<TopKind, TopItem[]>>>({})
  const blocked = useKirtanStore((s) => s.blockedAuthorIds)

  useEffect(() => {
    if (loaded[kind]) return
    const controller = new AbortController()
    loadShelfKind(api, kind, cache, Date.now(), controller.signal)
      .then((items) => setLoaded((prev) => ({ ...prev, [kind]: items })))
      .catch(() => {
        // a failed shelf stays out of the way; a failed chip shows an empty list
        if (!controller.signal.aborted) setLoaded((prev) => ({ ...prev, [kind]: [] }))
      })
    return () => controller.abort()
  }, [api, kind, loaded])

  const allRows = useMemo(() => (loaded.all ? shelfRows(loaded.all, blocked) : undefined), [loaded.all, blocked])
  const rows = useMemo(() => (loaded[kind] ? shelfRows(loaded[kind]!, blocked) : []), [loaded, kind, blocked])
  return { kind, setKind, rows, visible: shelfVisible(allRows), loading: !loaded[kind] }
}
