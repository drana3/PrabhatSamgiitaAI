import { isAuthorBlocked } from "@/lib/kirtan/blocked"
import type { RadioCategory } from "@/lib/radio/categories"
import type { TopItem, TopPage, TopPeriod, TopQuery } from "@/lib/topPlayed/types"

/**
 * The state of the Top Played screen as a pure reducer: which period and category chips are on, what was loaded, and
 * which of loading / ready / empty / error the screen shows. A response that belongs to an older choice (`seq` differs)
 * is dropped, so a slow answer never overwrites a newer one. No React, no network: the hook (hooks/useTopPlayed.ts) drives it.
 */

export const PAGE_SIZE = 30

export type TopKind = "all" | RadioCategory
export type TopStatus = "loading" | "ready" | "empty" | "error"

export type TopState = {
  period: TopPeriod
  kind: TopKind
  status: TopStatus
  items: TopItem[]
  total: number
  hasMore: boolean
  since: string | null
  minPlays: number
  /** a further page is being fetched under the list */
  loadingMore: boolean
  /** the further page failed: the list stays, the footer offers a retry */
  moreFailed: boolean
  /** bumped with every choice; answers carry the number they were asked under */
  seq: number
}

export type TopAction =
  | { type: "choose"; period?: TopPeriod; kind?: TopKind }
  | { type: "retry" }
  | { type: "loaded"; seq: number; page: TopPage; append: boolean }
  | { type: "failed"; seq: number; append: boolean }
  | { type: "more" }

export function initialTopState(period: TopPeriod = "all", kind: TopKind = "all"): TopState {
  return { period, kind, status: "loading", items: [], total: 0, hasMore: false, since: null, minPlays: 0, loadingMore: false, moreFailed: false, seq: 1 }
}

export function queryFor(state: Pick<TopState, "period" | "kind">, offset = 0): TopQuery {
  return { period: state.period, kinds: state.kind === "all" ? [] : [state.kind], limit: PAGE_SIZE, offset }
}

export function topReducer(state: TopState, action: TopAction): TopState {
  switch (action.type) {
    case "choose": {
      const period = action.period ?? state.period
      const kind = action.kind ?? state.kind
      if (period === state.period && kind === state.kind) return state
      return { ...initialTopState(period, kind), seq: state.seq + 1 }
    }
    case "retry":
      return { ...initialTopState(state.period, state.kind), seq: state.seq + 1 }
    case "more":
      if (!state.hasMore || state.loadingMore || state.status !== "ready") return state
      return { ...state, loadingMore: true, moreFailed: false }
    case "loaded": {
      if (action.seq !== state.seq) return state
      const items = action.append ? [...state.items, ...action.page.items] : action.page.items
      return {
        ...state,
        items,
        total: action.page.total,
        hasMore: action.page.hasMore,
        since: action.page.since,
        minPlays: action.page.minPlays,
        status: items.length ? "ready" : "empty",
        loadingMore: false,
        moreFailed: false,
      }
    }
    case "failed": {
      if (action.seq !== state.seq) return state
      if (action.append) return { ...state, loadingMore: false, moreFailed: true }
      return { ...state, status: "error", items: [], loadingMore: false }
    }
  }
}

/** The "counting since" line shows for the all-time list only: a 7 or 30 day list counts whole days back from today anyway. */
export function showSince(state: Pick<TopState, "period" | "since" | "status">): boolean {
  return state.period === "all" && Boolean(state.since) && state.status === "ready"
}

/** `1240` -> `1,240` (the device's own grouping); never throws. */
export function formatCount(n: number): string {
  try {
    return n.toLocaleString("en-US")
  } catch {
    return String(n)
  }
}

/**
 * What the screen shows: the loaded rows without the recordings of authors the person blocked (the server does not know
 * the person's blocks), ranks numbered again from 1 down the visible list, and the total reduced by what was left out.
 * Pure: unblocking an author brings the rows back, because `state.items` keeps everything that was loaded.
 */
export function visibleTop(
  state: Pick<TopState, "items" | "total">,
  blockedAuthorIds: readonly string[],
): { items: TopItem[]; total: number } {
  if (!blockedAuthorIds.length) return { items: state.items, total: state.total }
  const kept = state.items.filter(
    (item) => item.ref !== "rec" || !isAuthorBlocked({ authorId: item.recording?.author_id ?? null, author: item.author }, blockedAuthorIds),
  )
  const removed = state.items.length - kept.length
  return { items: kept.map((item, i) => ({ ...item, rank: i + 1 })), total: Math.max(kept.length, state.total - removed) }
}
