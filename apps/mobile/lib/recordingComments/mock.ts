import { MockFailure } from "@/lib/songComments/mock"
import { cleanDraft, draftProblem, sameTextKey } from "@/lib/songComments/rules"
import { tombstoneOf } from "@/lib/songComments/state"
import type { CommentPage, CommentReportReason } from "@/lib/songComments/types"

import type { RecordingComment, RecordingCommentsBackend } from "./types"

/**
 * The in-memory stand-in for the recording comments API, used ONLY in the web preview (`EXPO_PUBLIC_MOCKUP_DATA=1`).
 * Nothing here reaches a server and nothing survives a reload. It follows the real rules (clean text, link limit,
 * an anonymous comment carries no author). The seed is sample text for the preview; a real build never shows it.
 */
const MINUTE = 60_000

type Store = { byId: Map<string, RecordingComment>; order: string[]; reported: Set<string>; counter: number }

function seed(now: number): Array<Omit<RecordingComment, "id" | "recordingId">> {
  return [
    {
      body: "Sample comment for the preview. We sang this at the end of the retreat and nobody wanted to stop.",
      createdAt: new Date(now - 2 * 24 * 60 * MINUTE).toISOString(),
      isAnonymous: false,
      author: { name: "Preview member", avatarUrl: null },
      mine: false,
      canRemove: false,
    },
  ]
}

export function createRecordingCommentsMock(options: { me: () => string; now?: () => number } = { me: () => "You" }): RecordingCommentsBackend {
  const clock = options.now ?? Date.now
  const stores = new Map<string, Store>()
  const storeFor = (recordingId: string): Store => {
    let store = stores.get(recordingId)
    if (!store) {
      store = { byId: new Map(), order: [], reported: new Set(), counter: 0 }
      for (const item of seed(clock())) {
        store.counter += 1
        const id = `mock-${recordingId}-${store.counter}`
        store.byId.set(id, { ...item, id, recordingId })
        store.order.unshift(id)
      }
      stores.set(recordingId, store)
    }
    return store
  }
  const find = (commentId: string): { store: Store; comment: RecordingComment } => {
    for (const store of stores.values()) {
      const comment = store.byId.get(commentId)
      if (comment) return { store, comment }
    }
    throw new MockFailure("gone")
  }
  const sorted = (store: Store): RecordingComment[] =>
    store.order.map((id) => store.byId.get(id) as RecordingComment).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return {
    async list(recordingId, query): Promise<CommentPage<RecordingComment>> {
      const all = sorted(storeFor(recordingId))
      const items = all.slice(query.offset, query.offset + query.limit)
      return { items, total: all.length, hasMore: query.offset + items.length < all.length }
    },
    async post(recordingId, draft) {
      const problem = draftProblem(draft.body)
      if (problem) throw new MockFailure(problem)
      const body = cleanDraft(draft.body)
      const store = storeFor(recordingId)
      const key = sameTextKey(body)
      if (store.order.some((id) => (store.byId.get(id) as RecordingComment).mine && sameTextKey((store.byId.get(id) as RecordingComment).body) === key)) {
        throw new MockFailure("duplicate")
      }
      store.counter += 1
      const id = `mock-${recordingId}-${store.counter}`
      const comment: RecordingComment = {
        id,
        recordingId,
        body,
        createdAt: new Date(clock()).toISOString(),
        isAnonymous: draft.isAnonymous,
        author: draft.isAnonymous ? null : { name: options.me(), avatarUrl: null },
        mine: true,
        canRemove: false,
      }
      store.byId.set(id, comment)
      store.order.unshift(id)
      return comment
    },
    async remove(commentId) {
      const { store, comment } = find(commentId)
      if (!comment.mine && !comment.canRemove) throw new MockFailure("gone")
      // the author's own delete leaves a tombstone, as the real API does; a team removal leaves nothing
      if (comment.mine) store.byId.set(commentId, tombstoneOf(comment))
      else {
        store.byId.delete(commentId)
        store.order = store.order.filter((id) => id !== commentId)
      }
    },
    async report(commentId, _report: { reason: CommentReportReason }) {
      const { store } = find(commentId)
      if (store.reported.has(commentId)) return { status: "already_reported" as const }
      store.reported.add(commentId)
      return { status: "received" as const }
    },
  }
}
