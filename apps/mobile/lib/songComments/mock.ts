import { cleanDraft, draftProblem, sameTextKey } from "./rules"
import type { CommentFailure, CommentPage, CommentReportReason, CommentsBackend, SongComment } from "./types"

/**
 * The in-memory stand-in for the comments API, used ONLY in the web preview (`EXPO_PUBLIC_MOCKUP_DATA=1`, see
 * lib/songComments/backend.ts). Nothing here reaches a server and nothing survives a reload. It follows the same
 * rules as the real one (clean text, link limit, anonymous comments carry no author) so the screen can be checked.
 * The seed comments are sample text for the preview; they are never shown in a real build.
 */

/** The name a named comment gets in the preview when nobody is signed in. */
export const PREVIEW_NAME = "Preview member"

export class MockFailure extends Error {
  readonly failure: CommentFailure
  constructor(failure: CommentFailure) {
    super(failure)
    this.name = "MockFailure"
    this.failure = failure
  }
}

const MINUTE = 60_000

type Store = { byId: Map<string, SongComment>; order: string[]; reported: Set<string>; counter: number }

function seed(now: number): Array<Omit<SongComment, "id" | "songId">> {
  return [
    {
      body: "Sample comment for the preview. I first heard this song at a retreat, and the last line stayed with me for weeks.",
      createdAt: new Date(now - 3 * 24 * 60 * MINUTE).toISOString(),
      isAnonymous: false,
      author: { name: PREVIEW_NAME, avatarUrl: null },
      mine: false,
      canRemove: false,
    },
    {
      body: "Sample anonymous comment for the preview. Some things are easier to say without a name.",
      createdAt: new Date(now - 5 * 60 * MINUTE).toISOString(),
      isAnonymous: true,
      author: null,
      mine: false,
      canRemove: false,
    },
  ]
}

/** `me` is the name a named comment gets (the preview's signed-in name). */
export function createMockBackend(options: { me: () => string; now?: () => number } = { me: () => "You" }): CommentsBackend {
  const clock = options.now ?? Date.now
  const stores = new Map<number, Store>()

  const storeFor = (songId: number): Store => {
    let store = stores.get(songId)
    if (!store) {
      store = { byId: new Map(), order: [], reported: new Set(), counter: 0 }
      for (const item of seed(clock())) {
        store.counter += 1
        const id = `mock-${songId}-${store.counter}`
        store.byId.set(id, { ...item, id, songId })
        store.order.unshift(id)
      }
      stores.set(songId, store)
    }
    return store
  }
  const find = (commentId: string): { store: Store; comment: SongComment } => {
    for (const store of stores.values()) {
      const comment = store.byId.get(commentId)
      if (comment) return { store, comment }
    }
    throw new MockFailure("gone")
  }
  const sorted = (store: Store): SongComment[] =>
    store.order.map((id) => store.byId.get(id) as SongComment).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return {
    async list(songId, query): Promise<CommentPage> {
      const all = sorted(storeFor(songId))
      const items = all.slice(query.offset, query.offset + query.limit)
      return { items, total: all.length, hasMore: query.offset + items.length < all.length }
    },
    async post(songId, draft) {
      const problem = draftProblem(draft.body)
      if (problem) throw new MockFailure(problem)
      const body = cleanDraft(draft.body)
      const store = storeFor(songId)
      const key = sameTextKey(body)
      if (store.order.some((id) => (store.byId.get(id) as SongComment).mine && sameTextKey((store.byId.get(id) as SongComment).body) === key)) throw new MockFailure("duplicate")
      store.counter += 1
      const id = `mock-${songId}-${store.counter}`
      const comment: SongComment = {
        id,
        songId,
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
      store.byId.delete(commentId)
      store.order = store.order.filter((id) => id !== commentId)
    },
    async report(commentId, _report: { reason: CommentReportReason }) {
      const { store } = find(commentId)
      if (store.reported.has(commentId)) return { status: "already_reported" as const }
      store.reported.add(commentId)
      return { status: "received" as const }
    },
  }
}

/** The failure of a mock call, in the shape the section handles. */
export function mockFailure(error: unknown): CommentFailure | null {
  return error instanceof MockFailure ? error.failure : null
}
