import { useCallback, useEffect, useReducer, useRef } from "react"

import { COMMENT_PAGE_SIZE, cleanDraft, draftProblem } from "@/lib/songComments/rules"
import { emptyState, reducer, type Action, type CommentsState } from "@/lib/songComments/state"
import type { CommentBase, CommentFailure, CommentReportReason, CommentsBackendOf, PostOutcome } from "@/lib/songComments/types"

/** What a comments section uses: the state and the five things it can do. */
export type CommentsController<T extends CommentBase> = {
  state: CommentsState<T>
  reload: () => Promise<void>
  loadMore: () => Promise<void>
  post: (body: string, isAnonymous: boolean) => Promise<PostOutcome<T>>
  /** Resolves to null when it worked, or the failure. */
  remove: (id: string) => Promise<CommentFailure | null>
  report: (id: string, reason: CommentReportReason) => Promise<{ ok: true; status: "received" | "already_reported" } | { ok: false; failure: CommentFailure }>
}

/**
 * The comments of one target (a song, a recording): loads the first page and the next ones, posts, deletes and
 * reports. All the rules live in lib/songComments (tested); this only wires them to React. A reply that arrives after
 * the target changed or the page closed is dropped. `backend` and `failureOf` are read when called, never captured.
 */
export function useComments<T extends CommentBase, K extends string | number>(
  target: K,
  backend: () => CommentsBackendOf<T, K>,
  failureOf: (error: unknown) => CommentFailure,
  options: { tombstones?: boolean } = {},
): CommentsController<T> {
  const [state, dispatch] = useReducer(reducer as (s: CommentsState<T>, a: Action<T>) => CommentsState<T>, undefined, () => emptyState<T>())
  const stateRef = useRef(state)
  stateRef.current = state
  const current = useRef(target)
  current.current = target
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const fresh = (id: K) => mounted.current && current.current === id

  const load = useCallback(async () => {
    dispatch({ type: "reload" })
    try {
      const page = await backend().list(target, { limit: COMMENT_PAGE_SIZE, offset: 0 })
      if (fresh(target)) dispatch({ type: "loaded", page })
    } catch (error) {
      if (fresh(target)) dispatch({ type: "loadFailed", failure: failureOf(error) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  useEffect(() => {
    void load()
  }, [load])

  const loadMore = useCallback(async () => {
    if (state.more === "loading" || !state.hasMore) return
    dispatch({ type: "moreStart" })
    try {
      const page = await backend().list(target, { limit: COMMENT_PAGE_SIZE, offset: state.items.length })
      if (fresh(target)) dispatch({ type: "moreLoaded", page })
    } catch {
      if (fresh(target)) dispatch({ type: "moreFailed" })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, state.more, state.hasMore, state.items.length])

  const post = useCallback(
    async (body: string, isAnonymous: boolean): Promise<PostOutcome<T>> => {
      const problem = draftProblem(body)
      if (problem) return { ok: false, failure: problem }
      try {
        const comment = await backend().post(target, { body: cleanDraft(body), isAnonymous })
        if (fresh(target)) dispatch({ type: "posted", comment })
        return { ok: true, comment }
      } catch (error) {
        return { ok: false, failure: failureOf(error) }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target],
  )

  const remove = useCallback(
    async (id: string) => {
      try {
        await backend().remove(id)
        // the author's own delete leaves a tombstone where the server shows one (recordings), as a reload would
        if (fresh(target)) dispatch({ type: "removed", id, tombstone: Boolean(options.tombstones) && stateRef.current.items.some((c) => c.id === id && c.mine) })
        return null
      } catch (error) {
        const failure = failureOf(error)
        // already gone: the list should not keep showing it
        if (failure === "gone" && fresh(target)) dispatch({ type: "removed", id })
        return failure
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target],
  )

  const report = useCallback(async (id: string, reason: CommentReportReason) => {
    try {
      return { ok: true as const, status: (await backend().report(id, { reason })).status }
    } catch (error) {
      return { ok: false as const, failure: failureOf(error) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { state, reload: load, loadMore, post, remove, report }
}
