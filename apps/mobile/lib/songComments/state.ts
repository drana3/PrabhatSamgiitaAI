import type { CommentBase, CommentFailure, CommentPage, SongComment } from "./types"

/**
 * What the comments section knows, as a plain reducer (no React): the list, whether there is more, and one honest
 * status for the list. Posting and deleting update the list at once; the server stays the truth (a refresh replaces it).
 */
export type ListStatus = "loading" | "ready" | "error" | "offline"

export type CommentsState<T extends CommentBase = SongComment> = {
  status: ListStatus
  items: T[]
  total: number
  hasMore: boolean
  /** loading the next page */
  more: "idle" | "loading" | "error"
  /** the failure of the list call, for the retry text */
  failure: CommentFailure | null
}

export function emptyState<T extends CommentBase = SongComment>(): CommentsState<T> {
  return { status: "loading", items: [], total: 0, hasMore: false, more: "idle", failure: null }
}

export const initialState: CommentsState = emptyState()

export type Action<T extends CommentBase = SongComment> =
  | { type: "reload" }
  | { type: "loaded"; page: CommentPage<T> }
  | { type: "loadFailed"; failure: CommentFailure }
  | { type: "moreStart" }
  | { type: "moreLoaded"; page: CommentPage<T> }
  | { type: "moreFailed" }
  | { type: "posted"; comment: T }
  | { type: "removed"; id: string }

export function reducer<T extends CommentBase = SongComment>(state: CommentsState<T>, action: Action<T>): CommentsState<T> {
  switch (action.type) {
    case "reload":
      // keep what is on screen while it reloads; only the very first load shows the loading state
      return state.status === "ready" ? state : emptyState<T>()
    case "loaded":
      return { status: "ready", items: action.page.items, total: action.page.total, hasMore: action.page.hasMore, more: "idle", failure: null }
    case "loadFailed":
      return { ...state, status: action.failure === "network" ? "offline" : "error", failure: action.failure }
    case "moreStart":
      return state.more === "loading" ? state : { ...state, more: "loading" }
    case "moreLoaded": {
      const known = new Set(state.items.map((c) => c.id))
      const fresh = action.page.items.filter((c) => !known.has(c.id))
      return { ...state, items: [...state.items, ...fresh], total: action.page.total, hasMore: action.page.hasMore, more: "idle" }
    }
    case "moreFailed":
      return { ...state, more: "error" }
    case "posted": {
      if (state.items.some((c) => c.id === action.comment.id)) return state
      return { ...state, status: "ready", items: [action.comment, ...state.items], total: state.total + 1, failure: null }
    }
    case "removed": {
      if (!state.items.some((c) => c.id === action.id)) return state
      return { ...state, items: state.items.filter((c) => c.id !== action.id), total: Math.max(0, state.total - 1) }
    }
  }
}
