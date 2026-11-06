import { useCallback, useEffect, useReducer, useRef } from "react"

import { commentFailure, commentsBackend } from "@/lib/songComments/backend"
import { COMMENT_PAGE_SIZE, cleanDraft, draftProblem } from "@/lib/songComments/rules"
import { initialState, reducer } from "@/lib/songComments/state"
import type { CommentReportReason, PostOutcome } from "@/lib/songComments/types"

/**
 * The comments of one song: loads the first page, the next pages, and posts, deletes and reports. All the rules
 * live in lib/songComments (tested); this only wires them to React. A reply that arrives after the song changed
 * or the page closed is dropped.
 */
export function useSongComments(songId: number) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const current = useRef(songId)
  current.current = songId
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const fresh = (id: number) => mounted.current && current.current === id

  const load = useCallback(async () => {
    dispatch({ type: "reload" })
    try {
      const page = await commentsBackend().list(songId, { limit: COMMENT_PAGE_SIZE, offset: 0 })
      if (fresh(songId)) dispatch({ type: "loaded", page })
    } catch (error) {
      if (fresh(songId)) dispatch({ type: "loadFailed", failure: commentFailure(error) })
    }
  }, [songId])

  useEffect(() => {
    void load()
  }, [load])

  const loadMore = useCallback(async () => {
    if (state.more === "loading" || !state.hasMore) return
    dispatch({ type: "moreStart" })
    try {
      const page = await commentsBackend().list(songId, { limit: COMMENT_PAGE_SIZE, offset: state.items.length })
      if (fresh(songId)) dispatch({ type: "moreLoaded", page })
    } catch {
      if (fresh(songId)) dispatch({ type: "moreFailed" })
    }
  }, [songId, state.more, state.hasMore, state.items.length])

  const post = useCallback(
    async (body: string, isAnonymous: boolean): Promise<PostOutcome> => {
      const problem = draftProblem(body)
      if (problem) return { ok: false, failure: problem }
      try {
        const comment = await commentsBackend().post(songId, { body: cleanDraft(body), isAnonymous })
        if (fresh(songId)) dispatch({ type: "posted", comment })
        return { ok: true, comment }
      } catch (error) {
        return { ok: false, failure: commentFailure(error) }
      }
    },
    [songId],
  )

  /** Resolves to null when it worked, or the failure. */
  const remove = useCallback(
    async (id: string) => {
      try {
        await commentsBackend().remove(id)
        if (fresh(songId)) dispatch({ type: "removed", id })
        return null
      } catch (error) {
        const failure = commentFailure(error)
        // already gone: the list should not keep showing it
        if (failure === "gone" && fresh(songId)) dispatch({ type: "removed", id })
        return failure
      }
    },
    [songId],
  )

  const report = useCallback(async (id: string, reason: CommentReportReason) => {
    try {
      return { ok: true as const, status: (await commentsBackend().report(id, { reason })).status }
    } catch (error) {
      return { ok: false as const, failure: commentFailure(error) }
    }
  }, [])

  return { state, reload: load, loadMore, post, remove, report }
}
