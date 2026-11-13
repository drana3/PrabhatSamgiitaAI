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
  /** the comments people can read, the number to show (`total` minus a recording's tombstones) */
  live: number
  hasMore: boolean
  /** loading the next page */
  more: "idle" | "loading" | "error"
  /** the failure of the list call, for the retry text */
  failure: CommentFailure | null
}

export function emptyState<T extends CommentBase = SongComment>(): CommentsState<T> {
  return { status: "loading", items: [], total: 0, live: 0, hasMore: false, more: "idle", failure: null }
}

/** What is left of a comment its author deleted: no text, no author, nothing to act on. */
export function tombstoneOf<T extends CommentBase>(comment: T): T {
  return { ...comment, body: "", author: null, isAnonymous: true, mine: false, canRemove: false, deleted: true }
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
  | { type: "removed"; id: string; tombstone?: boolean }

export function reducer<T extends CommentBase = SongComment>(state: CommentsState<T>, action: Action<T>): CommentsState<T> {
  switch (action.type) {
    case "reload":
      // keep what is on screen while it reloads; only the very first load shows the loading state
      return state.status === "ready" ? state : emptyState<T>()
    case "loaded":
      return { status: "ready", items: action.page.items, total: action.page.total, live: action.page.liveTotal ?? action.page.total, hasMore: action.page.hasMore, more: "idle", failure: null }
    case "loadFailed":
      return { ...state, status: action.failure === "network" ? "offline" : "error", failure: action.failure }
    case "moreStart":
      return state.more === "loading" ? state : { ...state, more: "loading" }
    case "moreLoaded": {
      const known = new Set(state.items.map((c) => c.id))
      const fresh = action.page.items.filter((c) => !known.has(c.id))
      return { ...state, items: [...state.items, ...fresh], total: action.page.total, live: action.page.liveTotal ?? action.page.total, hasMore: action.page.hasMore, more: "idle" }
    }
    case "moreFailed":
      return { ...state, more: "error" }
    case "posted": {
      const comment = action.comment
      const known = (c: CommentBase): boolean => c.id === comment.id || (c.replies ?? []).some((r) => r.id === comment.id)
      if (state.items.some(known)) return state
      if (comment.parentId) {
        // a reply goes at the end of its conversation (oldest first); the count of readable comments grows by one, the paging total does not
        const items = state.items.map((c) => (c.id === comment.parentId ? ({ ...c, replies: [...(c.replies ?? []), comment] } as T) : c))
        return { ...state, status: "ready", items, live: state.live + 1, failure: null }
      }
      return { ...state, status: "ready", items: [comment, ...state.items], total: state.total + 1, live: state.live + 1, failure: null }
    }
    case "removed": {
      const top = state.items.find((c) => c.id === action.id)
      if (top) {
        // an author's own delete leaves a tombstone (its replies stay under it); a team removal takes the comment and its replies out of sight
        if (action.tombstone) return { ...state, items: state.items.map((c) => (c.id === action.id ? tombstoneOf(c) : c)), live: Math.max(0, state.live - 1) }
        const taken = (top.deleted ? 0 : 1) + (top.replies?.length ?? 0)
        return { ...state, items: state.items.filter((c) => c.id !== action.id), total: Math.max(0, state.total - 1), live: Math.max(0, state.live - taken) }
      }
      // a reply just goes
      if (!state.items.some((c) => (c.replies ?? []).some((r) => r.id === action.id))) return state
      const items = state.items.map((c) => ((c.replies ?? []).some((r) => r.id === action.id) ? ({ ...c, replies: (c.replies ?? []).filter((r) => r.id !== action.id) } as T) : c))
      return { ...state, items, live: Math.max(0, state.live - 1) }
    }
  }
}
