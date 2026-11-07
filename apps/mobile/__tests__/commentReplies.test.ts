import { describe, expect, it } from "vitest"

import { createRecordingCommentsMock } from "@/lib/recordingComments/mock"
import { recordingCommentFromWire, type WireRecordingComment } from "@/lib/recordingComments/remote"
import type { RecordingComment } from "@/lib/recordingComments/types"
import { createMockBackend, MockFailure } from "@/lib/songComments/mock"
import { MOCK_POSTS_PER_MINUTE, MOCK_THREAD_MAX_REPLIES } from "@/lib/songComments/mockCore"
import { commentFromWire, failureFromError, remoteBackend, type WireComment } from "@/lib/songComments/remote"
import { emptyState, reducer } from "@/lib/songComments/state"
import type { CommentBase, CommentPage, SongComment } from "@/lib/songComments/types"
import { RemoteError } from "@/lib/kirtan/remote"

const NOW = Date.parse("2026-11-07T10:00:00Z")
const top = (id: string, extra: Partial<SongComment> = {}): SongComment => ({
  id, songId: 7, body: `Top ${id}`, createdAt: "2026-11-01T10:00:00Z", isAnonymous: false, author: { name: "Ananda", avatarUrl: null }, mine: false, canRemove: false, replies: [], ...extra,
})
const reply = (id: string, parentId: string, extra: Partial<SongComment> = {}): SongComment => top(id, { parentId, ...extra })
const page = (items: SongComment[], total = items.length, liveTotal?: number): CommentPage => ({ items, total, liveTotal, hasMore: false })

describe("the reducer with replies", () => {
  const loaded = (items: SongComment[], total?: number, live?: number) => reducer(emptyState(), { type: "loaded", page: page(items, total, live) })
  it("puts a posted reply under its conversation, at the end, and counts it as readable but not as a page entry", () => {
    const s = loaded([top("a", { replies: [reply("r1", "a")] })], 1, 2)
    const next = reducer(s, { type: "posted", comment: reply("r2", "a") })
    expect(next.items[0]?.replies?.map((r) => r.id)).toEqual(["r1", "r2"])
    expect(next.total).toBe(1)
    expect(next.live).toBe(3)
  })
  it("does not repeat a reply it already holds", () => {
    const s = loaded([top("a", { replies: [reply("r1", "a")] })], 1, 2)
    expect(reducer(s, { type: "posted", comment: reply("r1", "a") })).toBe(s)
  })
  it("an author's delete of a top-level comment leaves a tombstone with its replies", () => {
    const s = loaded([top("a", { mine: true, replies: [reply("r1", "a")] })], 1, 2)
    const next = reducer(s, { type: "removed", id: "a", tombstone: true })
    expect(next.items[0]).toMatchObject({ deleted: true, body: "", author: null })
    expect(next.items[0]?.replies).toHaveLength(1)
    expect(next.live).toBe(1)
    expect(next.total).toBe(1)
  })
  it("a team removal takes the comment and its replies out of sight", () => {
    const s = loaded([top("a", { replies: [reply("r1", "a"), reply("r2", "a")] }), top("b")], 2, 4)
    const next = reducer(s, { type: "removed", id: "a" })
    expect(next.items.map((c) => c.id)).toEqual(["b"])
    expect(next.total).toBe(1)
    expect(next.live).toBe(1)
  })
  it("a removed reply just goes", () => {
    const s = loaded([top("a", { replies: [reply("r1", "a"), reply("r2", "a")] })], 1, 3)
    const next = reducer(s, { type: "removed", id: "r1", tombstone: true })
    expect(next.items[0]?.replies?.map((r) => r.id)).toEqual(["r2"])
    expect(next.live).toBe(2)
    expect(next.total).toBe(1)
  })
})

describe("the wire with replies", () => {
  const wire: WireComment = {
    id: "a", song_id: 7, body: "Top", created_at: "2026-11-01T10:00:00Z", is_anonymous: false, author: { name: "Ananda", avatar_url: null }, mine: false, can_remove: false,
    parent_id: null,
    replies: [
      { id: "r1", song_id: 7, body: "Reply", created_at: "2026-11-02T10:00:00Z", is_anonymous: true, author: { name: "Leak", avatar_url: null }, mine: false, can_remove: false, parent_id: "a", reply_to: { name: "Ananda", deleted: false } },
    ],
  }
  it("reads replies and the 'to Name' line, and never shows a name for an anonymous reply", () => {
    const c = commentFromWire(wire)
    expect(c.replies).toHaveLength(1)
    expect(c.replies?.[0]).toMatchObject({ parentId: "a", author: null, replyTo: { name: "Ananda", deleted: false } })
  })
  it("a tombstone keeps its replies and shows no text or author, whatever else the answer carries", () => {
    const c = commentFromWire({ ...wire, deleted: true, body: "secret", mine: true })
    expect(c).toMatchObject({ deleted: true, body: "", author: null, mine: false })
    expect(c.replies).toHaveLength(1)
  })
  it("reads a recording reply the same way", () => {
    const w: WireRecordingComment = { id: "x", recording_id: "r", body: "b", created_at: "2026-11-01T10:00:00Z", is_anonymous: false, author: { name: "N", avatar_url: null }, mine: false, can_remove: false, parent_id: "p", reply_to: { name: null, deleted: true } }
    expect(recordingCommentFromWire(w)).toMatchObject({ parentId: "p", replyTo: { name: null, deleted: true } })
  })
  it("sends parent_id only for a reply and maps a full conversation", async () => {
    const bodies: unknown[] = []
    const backend = remoteBackend({
      baseUrl: "https://api.test",
      headers: () => ({}),
      fetch: (async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)))
        return new Response(JSON.stringify(wire), { status: 200, headers: { "Content-Type": "application/json" } })
      }) as unknown as typeof fetch,
    })
    await backend.post(7, { body: "x", isAnonymous: false })
    await backend.post(7, { body: "y", isAnonymous: false, parentId: "a" })
    expect(bodies).toEqual([{ body: "x", is_anonymous: false }, { body: "y", is_anonymous: false, parent_id: "a" }])
    expect(failureFromError(new RemoteError(409, "full", { code: "comment_thread_full" }))).toBe("threadFull")
    expect(failureFromError(new RemoteError(409, "You already shared this comment."))).toBe("duplicate")
  })
})

describe("the in-memory backend with replies", () => {
  const make = (now = { value: NOW }) => ({ now, backend: createMockBackend({ me: () => "Me", now: () => now.value }) })
  it("lists a seed conversation with its reply and counts what people can read", async () => {
    const { backend } = make()
    const p = await backend.list(1, { limit: 20, offset: 0 })
    expect(p.total).toBe(2)
    expect(p.liveTotal).toBe(3)
    expect(p.items.find((c) => (c.replies ?? []).length > 0)?.replies?.[0]?.parentId).toBeTruthy()
  })
  it("a reply to a reply hangs under the same top comment and says who it answers", async () => {
    const { backend } = make()
    const first = (await backend.list(1, { limit: 20, offset: 0 })).items.find((c) => (c.replies ?? []).length > 0) as SongComment
    const r1 = await backend.post(1, { body: "First answer", isAnonymous: false, parentId: first.id })
    const r2 = await backend.post(1, { body: "Answer to the answer", isAnonymous: true, parentId: r1.id })
    expect(r2.parentId).toBe(first.id)
    expect(r2.replyTo).toEqual({ name: "Me", deleted: false })
    const p = await backend.list(1, { limit: 20, offset: 0 })
    expect(p.total).toBe(2)
    expect(p.liveTotal).toBe(5)
    expect(p.items.find((c) => c.id === first.id)?.replies?.map((r) => r.body.slice(0, 5))).toEqual(["Sampl", "First", "Answe"])
  })
  it("refuses a reply to an unknown or deleted comment, and the same text twice", async () => {
    const { backend } = make()
    await expect(backend.post(1, { body: "x ok", isAnonymous: false, parentId: "nope" })).rejects.toMatchObject({ failure: "gone" })
    const mine = await backend.post(1, { body: "Mine", isAnonymous: false })
    await backend.remove(mine.id)
    await expect(backend.post(1, { body: "Reply to a tombstone", isAnonymous: false, parentId: mine.id })).rejects.toMatchObject({ failure: "gone" })
    await backend.post(1, { body: "Same words", isAnonymous: false })
    await expect(backend.post(1, { body: "same words!", isAnonymous: false })).rejects.toMatchObject({ failure: "duplicate" })
  })
  it("deleting a top-level comment keeps its replies under a tombstone; deleting a reply just removes it", async () => {
    const { backend } = make()
    const mine = await backend.post(1, { body: "Mine", isAnonymous: false })
    const r = await backend.post(1, { body: "Reply to mine", isAnonymous: false, parentId: mine.id })
    await backend.remove(mine.id)
    let p = await backend.list(1, { limit: 20, offset: 0 })
    const tomb = p.items.find((c) => c.id === mine.id) as SongComment
    expect(tomb).toMatchObject({ deleted: true, body: "", author: null })
    expect(tomb.replies?.map((x) => x.id)).toEqual([r.id])
    await backend.remove(r.id)
    p = await backend.list(1, { limit: 20, offset: 0 })
    expect(p.items.find((c) => c.id === mine.id)?.replies).toEqual([])
    expect(p.liveTotal).toBe(3)
  })
  it("allows 5 posts a minute across replies and comments, then again after the minute", async () => {
    const { backend, now } = make()
    for (let i = 0; i < MOCK_POSTS_PER_MINUTE; i += 1) await backend.post(1, { body: `Post number ${i} here`, isAnonymous: false })
    await expect(backend.post(1, { body: "One more please", isAnonymous: false })).rejects.toMatchObject({ failure: "slowDown" })
    expect((await backend.list(1, { limit: 20, offset: 0 })).total).toBe(2 + MOCK_POSTS_PER_MINUTE)
    now.value += 61_000
    await expect(backend.post(1, { body: "One more please", isAnonymous: false })).resolves.toBeTruthy()
  })
  it("a conversation holds 50 replies", async () => {
    const { backend, now } = make()
    const first = (await backend.list(1, { limit: 20, offset: 0 })).items.find((c) => (c.replies ?? []).length > 0) as SongComment
    for (let i = 1; i < MOCK_THREAD_MAX_REPLIES; i += 1) {
      if (i % 5 === 0) now.value += 61_000
      await backend.post(1, { body: `Reply number ${i} in the thread`, isAnonymous: false, parentId: first.id })
    }
    now.value += 61_000
    await expect(backend.post(1, { body: "The fifty-first reply", isAnonymous: false, parentId: first.id })).rejects.toBeInstanceOf(MockFailure)
    await expect(backend.post(1, { body: "The fifty-first reply", isAnonymous: false, parentId: first.id })).rejects.toMatchObject({ failure: "threadFull" })
  })
  it("pages by top-level comment", async () => {
    const { backend, now } = make()
    for (let i = 0; i < 12; i += 1) {
      if (i % 5 === 0) now.value += 61_000
      await backend.post(1, { body: `Top level number ${i}`, isAnonymous: false })
    }
    const a = await backend.list(1, { limit: 5, offset: 0 })
    const b = await backend.list(1, { limit: 5, offset: 5 })
    expect(a.items).toHaveLength(5)
    expect(a.hasMore).toBe(true)
    expect(b.items.map((c) => c.id)).not.toContain(a.items[0]?.id)
    expect(a.total).toBe(14)
  })
})

describe("the recording mock shares the rules", () => {
  it("replies and tombstones work under a recording too", async () => {
    const backend = createRecordingCommentsMock({ me: () => "Me", now: () => NOW })
    const seed = (await backend.list("r1", { limit: 20, offset: 0 })).items[0] as RecordingComment
    const r = await backend.post("r1", { body: "An answer", isAnonymous: false, parentId: seed.id })
    expect(r).toMatchObject({ parentId: seed.id, recordingId: "r1" })
    const p = await backend.list("r1", { limit: 20, offset: 0 })
    expect(p.liveTotal).toBe(2)
    expect((p.items[0] as CommentBase).replies).toHaveLength(1)
  })
})
