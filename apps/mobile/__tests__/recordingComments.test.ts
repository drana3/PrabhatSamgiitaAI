import { describe, expect, it } from "vitest"

import { createRecordingCommentsMock } from "@/lib/recordingComments/mock"
import { recordingCommentFromWire, recordingCommentsRemote, recordingPageFromWire, type WireRecordingComment } from "@/lib/recordingComments/remote"
import { draftProblem, liveNotice } from "@/lib/songComments/rules"
import { emptyState, initialState, reducer } from "@/lib/songComments/state"
import type { CommentBase } from "@/lib/songComments/types"
import type { RecordingComment } from "@/lib/recordingComments/types"
import { MockFailure } from "@/lib/songComments/mock"
import { failureFromError } from "@/lib/songComments/remote"
import { RemoteError } from "@/lib/kirtan/remote"

import { CFG, fakeFetch, type Seen } from "./recordingExtrasHelpers"

const WIRE: WireRecordingComment = {
  id: "c1",
  recording_id: "r1",
  body: "A story",
  created_at: "2026-11-01T10:00:00Z",
  is_anonymous: false,
  author: { name: "Ananda", avatar_url: null },
  mine: false,
  can_remove: false,
}

describe("the wire", () => {
  it("never shows an author for an anonymous comment, whatever the answer carries", () => {
    expect(recordingCommentFromWire({ ...WIRE, is_anonymous: true, author: { name: "Leak", avatar_url: "x" } }).author).toBeNull()
    expect(recordingCommentFromWire(WIRE)).toMatchObject({ recordingId: "r1", author: { name: "Ananda", avatarUrl: null } })
  })
  it("reads a page", () => {
    expect(recordingPageFromWire({ items: [WIRE], total: 7, limit: 20, offset: 0, has_more: true })).toMatchObject({ total: 7, hasMore: true })
  })
  it("talks to the recording comments addresses", async () => {
    const seen: Seen[] = []
    const api = recordingCommentsRemote(CFG(fakeFetch({ status: 200, body: { items: [WIRE], total: 1, limit: 20, offset: 0, has_more: false } }, seen)))
    await api.list("r1", { limit: 20, offset: 40 })
    await api.post("r1", { body: "Hi", isAnonymous: true })
    await api.remove("c1")
    await api.report("c1", { reason: "spam" })
    expect(seen.map((s) => `${s.init.method} ${s.url.replace("https://api.example/api/v1/recording-comments", "")}`)).toEqual([
      "GET /recordings/r1?limit=20&offset=40",
      "POST /recordings/r1",
      "DELETE /c1",
      "POST /c1/report",
    ])
    expect(JSON.parse(seen[1]?.init.body as string)).toEqual({ body: "Hi", is_anonymous: true })
  })
  it("uses the song comments' failure mapping for its errors", () => {
    expect(failureFromError(new RemoteError(429, "x", { code: "comment_daily_limit" }))).toBe("dailyLimit")
    expect(failureFromError(new RemoteError(409, "You already shared this comment."))).toBe("duplicate")
  })
})

describe("the reducer is shared with the song comments", () => {
  it("holds recording comments without knowing about songs", () => {
    const one: RecordingComment = { ...recordingCommentFromWire(WIRE) }
    let state = emptyState<RecordingComment>()
    state = reducer(state, { type: "loaded", page: { items: [one], total: 1, hasMore: false } })
    expect(state.items[0]?.recordingId).toBe("r1")
    state = reducer(state, { type: "removed", id: "c1" })
    expect(state.total).toBe(0)
    expect(initialState.status).toBe("loading")
    const base: CommentBase[] = emptyState().items
    expect(base).toEqual([])
  })
})

describe("a deleted comment is a tombstone (QA-051)", () => {
  const DELETED: WireRecordingComment = { ...WIRE, id: "c9", body: "", author: null, is_anonymous: true, deleted: true }
  it("carries no text, author or action, whatever else the answer carries", () => {
    const t = recordingCommentFromWire({ ...DELETED, body: "leak", author: { name: "Leak", avatar_url: "x" }, mine: true, can_remove: true })
    expect(t).toMatchObject({ id: "c9", deleted: true, body: "", author: null, mine: false, canRemove: false })
  })
  it("stays in the list and the count when the author deletes, and only then", () => {
    const mine = { ...recordingCommentFromWire({ ...WIRE, mine: true }) }
    const other = { ...recordingCommentFromWire({ ...WIRE, id: "c2" }) }
    let state = reducer(emptyState<RecordingComment>(), { type: "loaded", page: { items: [mine, other], total: 2, hasMore: false } })
    state = reducer(state, { type: "removed", id: "c1", tombstone: true })
    expect(state.items[0]).toMatchObject({ id: "c1", deleted: true, body: "", author: null, mine: false })
    expect(state.total).toBe(2)
    // a plain removal (a team removal, a comment that is gone) takes the line away
    state = reducer(state, { type: "removed", id: "c2" })
    expect(state.items.map((c) => c.id)).toEqual(["c1"])
    expect(state.total).toBe(1)
  })
  it("shows the exact number: the server's live count, kept right through post and delete (QA-057)", () => {
    const wirePage = { items: [WIRE, DELETED, { ...DELETED, id: "c8" }], total: 3, live_total: 1, limit: 20, offset: 0, has_more: false }
    const page = recordingPageFromWire(wirePage)
    expect(page).toMatchObject({ total: 3, liveTotal: 1 })
    // only the first page is loaded (has_more): the count still counts every comment, not the loaded ones
    let state = reducer(emptyState<RecordingComment>(), { type: "loaded", page: { ...page, items: page.items.slice(0, 1), hasMore: true } })
    expect(state.live).toBe(1)
    state = reducer(state, { type: "moreLoaded", page })
    expect(state.live).toBe(1)
    const fresh = { ...recordingCommentFromWire({ ...WIRE, id: "c7", mine: true }) }
    state = reducer(state, { type: "posted", comment: fresh })
    expect([state.total, state.live]).toEqual([4, 2])
    state = reducer(state, { type: "removed", id: "c7", tombstone: true })
    expect([state.total, state.live]).toEqual([4, 1])
    state = reducer(state, { type: "removed", id: "c1" })
    expect([state.total, state.live]).toEqual([3, 0])
  })
  it("falls back to total where a page has no live count (songs)", () => {
    const state = reducer(emptyState(), { type: "loaded", page: { items: [], total: 4, hasMore: false } })
    expect(state.live).toBe(4)
  })
  it("the preview's live count leaves tombstones out", async () => {
    const api = createRecordingCommentsMock({ me: () => "Me" })
    const before = await api.list("r1", { limit: 20, offset: 0 })
    const posted = await api.post("r1", { body: "Mine to delete", isAnonymous: false })
    await api.remove(posted.id)
    const after = await api.list("r1", { limit: 20, offset: 0 })
    expect(after.total).toBe(before.total + 1)
    expect(after.liveTotal).toBe(before.liveTotal)
  })
  it("the preview keeps a tombstone for the author's own delete and nothing for another's", async () => {
    const api = createRecordingCommentsMock({ me: () => "Me" })
    const posted = await api.post("r1", { body: "Mine", isAnonymous: false })
    await api.remove(posted.id)
    const items = (await api.list("r1", { limit: 20, offset: 0 })).items
    expect(items.find((c) => c.id === posted.id)).toMatchObject({ deleted: true, body: "", author: null })
    // the same words can be shared again after the delete, as on the server
    await expect(api.post("r1", { body: "Mine", isAnonymous: false })).resolves.toBeTruthy()
  })
})

describe("the composer says why Post is shut (QA-050)", () => {
  it("says it while typing when there are more than two links", () => {
    expect(liveNotice("a https://a.example b https://b.example c https://c.example")).toBe("links")
    expect(liveNotice("one https://a.example and two https://b.example")).toBeNull()
    expect(liveNotice("")).toBeNull()
    expect(liveNotice("x".repeat(2500))).toBeNull()
  })
  it("is exactly the case that shuts the button", () => {
    const text = "https://a.example https://b.example https://c.example"
    expect(draftProblem(text)).toBe("links")
    expect(liveNotice(text)).toBe("links")
  })
})

describe("the preview backend", () => {
  const make = () => createRecordingCommentsMock({ me: () => "Me" })
  it("keeps comments per recording, newest first", async () => {
    const api = make()
    await api.post("r1", { body: "First", isAnonymous: false })
    expect((await api.list("r1", { limit: 20, offset: 0 })).items[0]?.body).toBe("First")
    expect((await api.list("r2", { limit: 20, offset: 0 })).items.some((c) => c.body === "First")).toBe(false)
  })
  it("posts anonymously without an author and refuses the same words again", async () => {
    const api = make()
    expect((await api.post("r1", { body: "Quiet", isAnonymous: true })).author).toBeNull()
    await expect(api.post("r1", { body: " quiet! ", isAnonymous: false })).rejects.toMatchObject({ failure: "duplicate" })
  })
  it("refuses empty text and too many links like the real one", async () => {
    const api = make()
    await expect(api.post("r1", { body: "   ", isAnonymous: false })).rejects.toBeInstanceOf(MockFailure)
    await expect(api.post("r1", { body: "a.com b.com c.com", isAnonymous: false })).rejects.toMatchObject({ failure: "links" })
  })
  it("the author deletes, nobody else may; a repeated report is acknowledged", async () => {
    const api = make()
    const mine = await api.post("r1", { body: "Mine", isAnonymous: false })
    await api.remove(mine.id)
    const [seed] = (await api.list("r1", { limit: 20, offset: 0 })).items
    await expect(api.remove(seed?.id as string)).rejects.toMatchObject({ failure: "gone" })
    expect((await api.report(seed?.id as string, { reason: "spam" })).status).toBe("received")
    expect((await api.report(seed?.id as string, { reason: "spam" })).status).toBe("already_reported")
  })
})
