import { describe, expect, it } from "vitest"

import { createMockBackend } from "@/lib/songComments/mock"
import { failureFromError, commentFromWire, pageFromWire, remoteBackend, type WireComment } from "@/lib/songComments/remote"
import {
  COMMENT_MAX_LENGTH,
  charactersLeft,
  cleanDraft,
  commentableSong,
  draftProblem,
  elapsed,
  initialOf,
  linkCount,
  postingAccess,
  postingAs,
  showCounter,
} from "@/lib/songComments/rules"
import { initialState, reducer, type CommentsState } from "@/lib/songComments/state"
import type { SongComment } from "@/lib/songComments/types"
import { NetworkError, RemoteError } from "@/lib/kirtan/remote"

const comment = (id: string, over: Partial<SongComment> = {}): SongComment => ({
  id,
  songId: 19,
  body: `body ${id}`,
  createdAt: "2026-11-01T10:00:00Z",
  isAnonymous: false,
  author: { name: "Ananda", avatarUrl: null },
  mine: false,
  canRemove: false,
  ...over,
})

describe("draft rules (the same as the API)", () => {
  it("cleans the text like the server does", () => {
    expect(cleanDraft("  Hello   world \r\n\r\n\r\n\r\nSecond\u0000 line  ")).toBe("Hello world\n\nSecond line")
    expect(cleanDraft("  \n ")).toBe("")
  })
  it("says why a draft cannot be posted", () => {
    expect(draftProblem("   ")).toBe("empty")
    expect(draftProblem("x".repeat(COMMENT_MAX_LENGTH + 1))).toBe("tooLong")
    expect(draftProblem("x".repeat(COMMENT_MAX_LENGTH))).toBeNull()
    expect(draftProblem("see https://a.example and www.b.example")).toBeNull()
    expect(draftProblem("https://a.example https://b.example http://c.example")).toBe("links")
    expect(linkCount("HTTP://A.example")).toBe(1)
  })
  it("shows the counter only near the limit", () => {
    expect(showCounter("x".repeat(100))).toBe(false)
    expect(showCounter("x".repeat(1800))).toBe(true)
    expect(charactersLeft("x".repeat(1990))).toBe(10)
    expect(charactersLeft("x".repeat(2100))).toBe(-100)
  })
  it("tells who the comment will be posted as", () => {
    expect(postingAs(false, " Ananda ")).toEqual({ kind: "named", name: "Ananda" })
    expect(postingAs(true, "Ananda")).toEqual({ kind: "anonymous" })
  })
  it("only the real song numbers can have comments", () => {
    expect(commentableSong(1)).toBe(1)
    expect(commentableSong(5018)).toBe(5018)
    for (const bad of [0, 5019, 1.5, "19", null, undefined, Number.NaN]) expect(commentableSong(bad)).toBeNull()
  })
  it("takes the first letter of a name, also from another script", () => {
    expect(initialOf("ananda")).toBe("A")
    expect(initialOf("  Мария")).toBe("М")
    expect(initialOf("")).toBe("?")
  })
})

describe("who may write", () => {
  it("only a signed-in member the server can recognise; the preview always", () => {
    expect(postingAccess({ preview: true, signedIn: false, canProve: false })).toBe("ok")
    expect(postingAccess({ preview: false, signedIn: false, canProve: false })).toBe("signin")
    expect(postingAccess({ preview: false, signedIn: true, canProve: false })).toBe("unavailable")
    expect(postingAccess({ preview: false, signedIn: true, canProve: true })).toBe("ok")
  })
})

describe("elapsed", () => {
  const now = Date.parse("2026-11-06T12:00:00Z")
  const ago = (ms: number) => new Date(now - ms).toISOString()
  it("counts in one unit", () => {
    expect(elapsed(ago(20_000), now)).toEqual({ kind: "now" })
    expect(elapsed(ago(5 * 60_000), now)).toEqual({ kind: "minutes", count: 5 })
    expect(elapsed(ago(3 * 3_600_000), now)).toEqual({ kind: "hours", count: 3 })
    expect(elapsed(ago(2 * 86_400_000), now)).toEqual({ kind: "days", count: 2 })
    expect(elapsed(ago(7 * 86_400_000), now)).toEqual({ kind: "date" })
  })
  it("a clock a little ahead of the server is still 'just now'; a broken date is a date", () => {
    expect(elapsed(new Date(now + 90_000).toISOString(), now)).toEqual({ kind: "now" })
    expect(elapsed("nonsense", now)).toEqual({ kind: "date" })
  })
})

describe("the list state", () => {
  const page = (ids: string[], total = ids.length, hasMore = false) => ({ items: ids.map((i) => comment(i)), total, hasMore })
  it("starts loading, then ready", () => {
    expect(initialState.status).toBe("loading")
    const s = reducer(initialState, { type: "loaded", page: page(["a", "b"], 5, true) })
    expect(s).toMatchObject({ status: "ready", total: 5, hasMore: true })
  })
  it("separates offline from a server error", () => {
    expect(reducer(initialState, { type: "loadFailed", failure: "network" }).status).toBe("offline")
    expect(reducer(initialState, { type: "loadFailed", failure: "server" }).status).toBe("error")
  })
  it("a reload keeps what is on screen", () => {
    const ready = reducer(initialState, { type: "loaded", page: page(["a"]) })
    expect(reducer(ready, { type: "reload" })).toBe(ready)
    const failed = reducer(initialState, { type: "loadFailed", failure: "network" })
    expect(reducer(failed, { type: "reload" }).status).toBe("loading")
  })
  it("a new comment goes on top, once", () => {
    const ready = reducer(initialState, { type: "loaded", page: page(["a"]) })
    const posted = reducer(ready, { type: "posted", comment: comment("n", { mine: true }) })
    expect(posted.items.map((c) => c.id)).toEqual(["n", "a"])
    expect(posted.total).toBe(2)
    expect(reducer(posted, { type: "posted", comment: comment("n") })).toBe(posted)
  })
  it("posting into an empty or failed list makes it ready", () => {
    const failed = reducer(initialState, { type: "loadFailed", failure: "network" })
    expect(reducer(failed, { type: "posted", comment: comment("n") }).status).toBe("ready")
  })
  it("the next page is added without repeating a comment", () => {
    let s = reducer(initialState, { type: "loaded", page: page(["a", "b"], 4, true) })
    s = reducer(s, { type: "moreStart" })
    expect(s.more).toBe("loading")
    s = reducer(s, { type: "moreLoaded", page: page(["b", "c", "d"], 4, false) })
    expect(s.items.map((c) => c.id)).toEqual(["a", "b", "c", "d"])
    expect(s).toMatchObject({ hasMore: false, more: "idle" })
    expect(reducer(s, { type: "moreFailed" }).more).toBe("error")
  })
  it("a removed comment leaves the list and the count never goes below zero", () => {
    let s: CommentsState = reducer(initialState, { type: "loaded", page: page(["a"], 1) })
    s = reducer(s, { type: "removed", id: "a" })
    expect(s).toMatchObject({ items: [], total: 0 })
    expect(reducer(s, { type: "removed", id: "zzz" })).toBe(s)
  })
})

describe("the wire", () => {
  const wire = (over: Partial<WireComment> = {}): WireComment => ({
    id: "c1",
    song_id: 19,
    body: "hello",
    created_at: "2026-11-01T10:00:00Z",
    is_anonymous: false,
    author: { name: "Ananda", avatar_url: "https://img/a.png" },
    mine: false,
    can_remove: true,
    ...over,
  })
  it("maps a named comment", () => {
    expect(commentFromWire(wire())).toMatchObject({ songId: 19, author: { name: "Ananda", avatarUrl: "https://img/a.png" }, canRemove: true })
  })
  it("an anonymous comment has no author, even if a broken server sent one", () => {
    expect(commentFromWire(wire({ is_anonymous: true, author: null })).author).toBeNull()
    expect(commentFromWire(wire({ is_anonymous: true, author: { name: "LEAK", avatar_url: "x" } })).author).toBeNull()
  })
  it("maps a page", () => {
    expect(pageFromWire({ items: [wire()], total: 9, limit: 20, offset: 0, has_more: true })).toMatchObject({ total: 9, hasMore: true })
  })
  it("turns errors into the failures the section knows", () => {
    expect(failureFromError(new NetworkError())).toBe("network")
    expect(failureFromError(new RemoteError(401, "Sign in is required"))).toBe("signin")
    expect(failureFromError(new RemoteError(429, "x", { code: "comment_daily_limit" }))).toBe("dailyLimit")
    expect(failureFromError(new RemoteError(429, "Please wait a little before trying again."))).toBe("slowDown")
    expect(failureFromError(new RemoteError(409, "You already shared this comment."))).toBe("duplicate")
    expect(failureFromError(new RemoteError(404, "Comment not found"))).toBe("gone")
    expect(failureFromError(new RemoteError(422, "Please use at most two links in a comment."))).toBe("links")
    expect(failureFromError(new RemoteError(422, "String should have at most 2000 characters"))).toBe("tooLong")
    expect(failureFromError(new RemoteError(500, "boom"))).toBe("server")
    expect(failureFromError(new Error("?"))).toBe("server")
  })
})

describe("the real backend against a fake server", () => {
  function fake(responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>) {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetchFake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      const next = responses.shift() as { status: number; body?: unknown; headers?: Record<string, string> }
      return new Response(next.body === undefined ? null : JSON.stringify(next.body), { status: next.status, headers: next.headers })
    }) as unknown as typeof fetch
    return { calls, backend: remoteBackend({ baseUrl: "https://api.test/", headers: () => ({ "X-Member-Proxy-Key": "k" }), fetch: fetchFake }) }
  }
  it("lists, posts, reports and deletes with the right requests", async () => {
    const wireItem = { id: "c1", song_id: 19, body: "hi", created_at: "2026-11-01T10:00:00Z", is_anonymous: true, author: null, mine: true, can_remove: false }
    const { calls, backend } = fake([
      { status: 200, body: { items: [wireItem], total: 1, limit: 20, offset: 0, has_more: false } },
      { status: 201, body: wireItem },
      { status: 201, body: { status: "received", message: "ok" } },
      { status: 204 },
    ])
    const page = await backend.list(19, { limit: 20, offset: 0 })
    expect(page.items[0]?.author).toBeNull()
    const made = await backend.post(19, { body: "hi", isAnonymous: true })
    expect(made.mine).toBe(true)
    expect((await backend.report("c1", { reason: "spam" })).status).toBe("received")
    await backend.remove("c1")
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([
      "GET https://api.test/api/v1/song-comments/songs/19?limit=20&offset=0",
      "POST https://api.test/api/v1/song-comments/songs/19",
      "POST https://api.test/api/v1/song-comments/c1/report",
      "DELETE https://api.test/api/v1/song-comments/c1",
    ])
    expect(JSON.parse(String(calls[1]?.init.body))).toEqual({ body: "hi", is_anonymous: true })
    expect(JSON.parse(String(calls[2]?.init.body))).toEqual({ reason: "spam" })
    expect((calls[0]?.init.headers as Record<string, string>)["X-Member-Proxy-Key"]).toBe("k")
  })
  it("reports a daily limit and a missing network", async () => {
    const { backend } = fake([{ status: 429, body: { detail: "You can add up to 20 comments a day." }, headers: { "X-Error-Code": "comment_daily_limit" } }])
    const error = await backend.post(19, { body: "x", isAnonymous: false }).catch((e: unknown) => e)
    expect(failureFromError(error)).toBe("dailyLimit")
    const down = remoteBackend({ baseUrl: "https://api.test", headers: () => ({}), fetch: (async () => { throw new TypeError("Network request failed") }) as unknown as typeof fetch })
    expect(failureFromError(await down.list(19, { limit: 20, offset: 0 }).catch((e: unknown) => e))).toBe("network")
  })
})

describe("the preview's in-memory backend", () => {
  const make = () => createMockBackend({ me: () => "Preview member", now: () => Date.parse("2026-11-06T12:00:00Z") })
  it("starts with its sample comments, newest first, one of them anonymous without an author", async () => {
    const page = await make().list(19, { limit: 20, offset: 0 })
    expect(page.total).toBe(2)
    expect(page.items.map((c) => c.createdAt)).toEqual([...page.items.map((c) => c.createdAt)].sort().reverse())
    const anonymous = page.items.find((c) => c.isAnonymous)
    expect(anonymous?.author).toBeNull()
  })
  it("posts named and anonymous, refuses the same words twice, deletes its own", async () => {
    const backend = make()
    const named = await backend.post(19, { body: "  My   story ", isAnonymous: false })
    expect(named).toMatchObject({ body: "My story", mine: true, author: { name: "Preview member" } })
    const hidden = await backend.post(19, { body: "Quiet one", isAnonymous: true })
    expect(hidden.author).toBeNull()
    await expect(backend.post(19, { body: "My story", isAnonymous: true })).rejects.toMatchObject({ failure: "duplicate" })
    await expect(backend.post(19, { body: "  ", isAnonymous: false })).rejects.toMatchObject({ failure: "empty" })
    await backend.remove(named.id)
    expect((await backend.list(19, { limit: 20, offset: 0 })).total).toBe(3)
    await expect(backend.remove("nope")).rejects.toMatchObject({ failure: "gone" })
  })
  it("keeps songs apart and a report once", async () => {
    const backend = make()
    await backend.post(19, { body: "only here", isAnonymous: false })
    expect((await backend.list(20, { limit: 20, offset: 0 })).total).toBe(2)
    const first = (await backend.list(19, { limit: 20, offset: 0 })).items[0] as SongComment
    expect((await backend.report(first.id, { reason: "spam" })).status).toBe("received")
    expect((await backend.report(first.id, { reason: "spam" })).status).toBe("already_reported")
  })
  it("pages", async () => {
    const backend = make()
    const first = await backend.list(19, { limit: 1, offset: 0 })
    expect(first).toMatchObject({ hasMore: true, total: 2 })
    expect((await backend.list(19, { limit: 1, offset: 1 })).hasMore).toBe(false)
  })
})
