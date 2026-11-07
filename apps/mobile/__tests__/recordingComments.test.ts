import { describe, expect, it } from "vitest"

import { createRecordingCommentsMock } from "@/lib/recordingComments/mock"
import { recordingCommentFromWire, recordingCommentsRemote, recordingPageFromWire, type WireRecordingComment } from "@/lib/recordingComments/remote"
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
