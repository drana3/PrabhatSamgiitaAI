import { cleanDraft, draftProblem, sameTextKey } from "./rules"
import { tombstoneOf } from "./state"
import type { CommentBase, CommentFailure, CommentPage, CommentReportReason, CommentsBackendOf } from "./types"

/**
 * The in-memory stand-in for the comments APIs (songs and recordings), used ONLY in the web preview and in tests.
 * Nothing here reaches a server and nothing survives a reload. It follows the same rules as the real one: clean
 * text, link limit, an anonymous comment carries no author, one level of replies, 50 replies in a conversation,
 * five posts a minute, an author's own delete leaves a tombstone on a top-level comment.
 */

export class MockFailure extends Error {
  readonly failure: CommentFailure
  constructor(failure: CommentFailure) {
    super(failure)
    this.name = "MockFailure"
    this.failure = failure
  }
}

/** The same numbers as the API (apps/api/app/services/comment_threads.py and extras_common.py). */
export const MOCK_THREAD_MAX_REPLIES = 50
export const MOCK_POSTS_PER_MINUTE = 5

type Entry<T extends CommentBase> = { comment: T; replyToId: string | null }
type Store<T extends CommentBase> = { byId: Map<string, Entry<T>>; tops: string[]; reported: Set<string>; counter: number }

/** A seed row without ids; the anchor and the id are added by the core. */
export type SeedRow = Pick<CommentBase, "body" | "createdAt" | "isAnonymous" | "author"> & Partial<CommentBase>

export function createMockCore<T extends CommentBase, K extends string | number>(options: {
  me: () => string
  now?: () => number
  anchor: (target: K) => Partial<T>
  seed: (now: number) => Array<{ top: SeedRow; replies?: SeedRow[] }>
}): CommentsBackendOf<T, K> {
  const clock = options.now ?? Date.now
  const stores = new Map<K, Store<T>>()
  const posts: number[] = []

  const add = (store: Store<T>, target: K, row: SeedRow, parentId: string | null, replyToId: string | null): T => {
    store.counter += 1
    const id = `mock-${String(target)}-${store.counter}`
    const comment = { mine: false, canRemove: false, ...row, ...options.anchor(target), id, parentId, replies: [] } as unknown as T
    store.byId.set(id, { comment, replyToId })
    if (parentId === null) store.tops.unshift(id)
    return comment
  }
  const storeFor = (target: K): Store<T> => {
    let store = stores.get(target)
    if (!store) {
      store = { byId: new Map(), tops: [], reported: new Set(), counter: 0 }
      stores.set(target, store)
      for (const item of options.seed(clock())) {
        const top = add(store, target, item.top, null, null)
        for (const reply of item.replies ?? []) add(store, target, reply, top.id, null)
      }
    }
    return store
  }
  const find = (commentId: string): { store: Store<T>; entry: Entry<T> } => {
    for (const store of stores.values()) {
      const entry = store.byId.get(commentId)
      if (entry) return { store, entry }
    }
    throw new MockFailure("gone")
  }
  const repliesOf = (store: Store<T>, topId: string): Entry<T>[] =>
    [...store.byId.values()].filter((e) => e.comment.parentId === topId).sort((a, b) => a.comment.createdAt.localeCompare(b.comment.createdAt))
  const nameOf = (comment: CommentBase): string | null => (comment.isAnonymous ? null : (comment.author?.name ?? null))
  const render = (store: Store<T>, top: Entry<T>): T => {
    const replies = repliesOf(store, top.comment.id).map((entry) => {
      const answered = entry.replyToId ? store.byId.get(entry.replyToId) : undefined
      const replyTo = entry.replyToId ? { name: answered ? nameOf(answered.comment) : null, deleted: !answered } : null
      return { ...entry.comment, replies: [], replyTo }
    })
    return { ...top.comment, replies } as T
  }
  const tops = (store: Store<T>): Entry<T>[] =>
    store.tops.map((id) => store.byId.get(id) as Entry<T>).sort((a, b) => b.comment.createdAt.localeCompare(a.comment.createdAt))
  const liveTotal = (store: Store<T>): number => tops(store).reduce((n, top) => n + (top.comment.deleted ? 0 : 1) + repliesOf(store, top.comment.id).length, 0)

  const flood = (): void => {
    const now = clock()
    while (posts.length && now - (posts[0] as number) >= 60_000) posts.shift()
    if (posts.length >= MOCK_POSTS_PER_MINUTE) throw new MockFailure("slowDown")
    posts.push(now)
  }

  return {
    async list(target, query): Promise<CommentPage<T>> {
      const store = storeFor(target)
      const all = tops(store)
      const items = all.slice(query.offset, query.offset + query.limit).map((top) => render(store, top))
      return { items, total: all.length, liveTotal: liveTotal(store), hasMore: query.offset + items.length < all.length }
    },
    async post(target, draft) {
      const problem = draftProblem(draft.body)
      if (problem) throw new MockFailure(problem)
      const body = cleanDraft(draft.body)
      const store = storeFor(target)
      let parentId: string | null = null
      let replyToId: string | null = null
      if (draft.parentId) {
        const answered = store.byId.get(draft.parentId)
        if (!answered || answered.comment.deleted) throw new MockFailure("gone")
        const topId = answered.comment.parentId ?? answered.comment.id
        const top = store.byId.get(topId)
        if (!top || top.comment.deleted) throw new MockFailure("gone")
        if (repliesOf(store, topId).length >= MOCK_THREAD_MAX_REPLIES) throw new MockFailure("threadFull")
        parentId = topId
        replyToId = answered.comment.parentId ? answered.comment.id : null
      }
      flood()
      const key = sameTextKey(body)
      if ([...store.byId.values()].some((e) => e.comment.mine && !e.comment.deleted && sameTextKey(e.comment.body) === key)) throw new MockFailure("duplicate")
      const comment = add(
        store,
        target,
        {
          body,
          createdAt: new Date(clock()).toISOString(),
          isAnonymous: draft.isAnonymous,
          author: draft.isAnonymous ? null : { name: options.me(), avatarUrl: null },
          mine: true,
          canRemove: false,
        },
        parentId,
        replyToId,
      )
      const answered = replyToId ? store.byId.get(replyToId) : undefined
      return { ...comment, replies: [], replyTo: replyToId ? { name: answered ? nameOf(answered.comment) : null, deleted: !answered } : null }
    },
    async remove(commentId) {
      const { store, entry } = find(commentId)
      const { comment } = entry
      if (!comment.mine && !comment.canRemove) throw new MockFailure("gone")
      if (comment.parentId) {
        store.byId.delete(commentId) // a reply just goes
        return
      }
      if (comment.mine) {
        store.byId.set(commentId, { ...entry, comment: tombstoneOf(comment) }) // the replies stay under the tombstone
        return
      }
      for (const reply of repliesOf(store, commentId)) store.byId.delete(reply.comment.id) // a team removal takes the replies with it
      store.byId.delete(commentId)
      store.tops = store.tops.filter((id) => id !== commentId)
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
