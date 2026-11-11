import { useCallback, useEffect, useMemo, useReducer, useRef } from "react"

import { topPlayedApi } from "@/lib/topPlayed/api"
import { initialTopState, queryFor, topReducer, visibleTop, type TopKind } from "@/lib/topPlayed/model"
import type { TopPeriod, TopPlayedApi } from "@/lib/topPlayed/types"
import { useKirtanStore } from "@/stores/kirtanStore"

/**
 * Drives the Top Played screen: asks the server for the first page whenever a chip changes (older answers are dropped by
 * the reducer), and for the next page when the list is scrolled to its end.
 */
export function useTopPlayed(api: TopPlayedApi = topPlayedApi(), start?: { period?: TopPeriod; kind?: TopKind; scope?: readonly string[] }) {
  const [state, dispatch] = useReducer(topReducer, initialTopState(start?.period, start?.kind, start?.scope))
  const stateRef = useRef(state)
  stateRef.current = state

  // the first page, again for every new choice (seq changes) and for "Try again"
  useEffect(() => {
    const controller = new AbortController()
    const { seq } = state
    api
      .fetch(queryFor(state, 0), controller.signal)
      .then((page) => dispatch({ type: "loaded", seq, page, append: false }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return
        dispatch({ type: "failed", seq, append: false })
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.seq, api])

  const more = useCallback(() => {
    const current = stateRef.current
    if (!current.hasMore || current.loadingMore || current.status !== "ready") return
    dispatch({ type: "more" })
    const { seq } = current
    api
      .fetch(queryFor(current, current.items.length))
      .then((page) => dispatch({ type: "loaded", seq, page, append: true }))
      .catch(() => dispatch({ type: "failed", seq, append: true }))
  }, [api])

  // the person's blocked authors are applied on top of what was loaded (paging still counts the raw rows)
  const blocked = useKirtanStore((s) => s.blockedAuthorIds)
  const view = useMemo(() => visibleTop(state, blocked), [state.items, state.total, blocked])

  return {
    state,
    /** the rows to show (blocked authors left out, ranks renumbered) */
    view,
    setPeriod: (period: TopPeriod) => dispatch({ type: "choose", period }),
    setKind: (kind: TopKind) => dispatch({ type: "choose", kind }),
    retry: () => dispatch({ type: "retry" }),
    more,
  }
}
