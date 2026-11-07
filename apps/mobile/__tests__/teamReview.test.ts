import { describe, expect, it } from "vitest"

import { RemoteError, NetworkError } from "@/lib/kirtan/remote"
import { createTeamReviewMock } from "@/lib/teamReview/mock"
import { commentItem, reviewFailureFromError, sheetItem, teamReviewRemote, videoItem } from "@/lib/teamReview/remote"
import { actionsFor, badgeLabel, reasonProblem, sheetPreview, tabTotal } from "@/lib/teamReview/rules"

import { CFG, fakeFetch, type Seen } from "./recordingExtrasHelpers"

describe("rules", () => {
  it("an open item is approved or removed; a removed one is restored", () => {
    expect(actionsFor({ list: "open" })).toEqual(["approve", "remove"])
    expect(actionsFor({ list: "removed" })).toEqual(["restore"])
  })
  it("only a chord sheet needs a reason of 3 characters", () => {
    expect(reasonProblem({ source: "recordingSheet" }, "  ab ")).toBe("short")
    expect(reasonProblem({ source: "recordingSheet" }, "abc")).toBeNull()
    expect(reasonProblem({ source: "video" }, "")).toBeNull()
    expect(reasonProblem({ source: "songComment" }, "")).toBeNull()
  })
  it("badges: nothing for zero, 99+ past 99", () => {
    expect([badgeLabel(0), badgeLabel(7), badgeLabel(100), badgeLabel(Number.NaN)]).toEqual([null, "7", "99+", null])
    expect(tabTotal({ sheets: 1, comments: 2, videos: 3 })).toBe(6)
  })
  it("shows the first lines of a sheet", () => {
    expect(sheetPreview("a\nb\nc\nd\ne", 3)).toBe("a\nb\nc")
  })
})

describe("the wire", () => {
  it("maps the three kinds to one item shape, keeping the author of an anonymous item for the team", () => {
    const sheet = sheetItem({ id: "s", recording_id: "r", instrument: "guitar", body: "Am", created_at: "2026-11-01T00:00:00Z", is_anonymous: true, author_name: "Real Name", reports_count: 0, status: "pending" }, "open")
    expect(sheet).toMatchObject({ key: "recordingSheet:s", tab: "sheets", authorName: "Real Name", isAnonymous: true, place: { kind: "recording", id: "r" } })
    const comment = commentItem({ id: "c", song_id: 19, body: "x", created_at: "2026-11-01T00:00:00Z", is_anonymous: false, author_name: "N", reports_count: 2, parent_id: "p" }, "songComment", "open")
    expect(comment).toMatchObject({ tab: "comments", place: { kind: "song", number: 19 }, isReply: true, reportsCount: 2 })
    const video = videoItem({ id: "v", song_id: null, recording_id: "r", url: "https://youtu.be/x", title: "T", created_at: "2026-11-01T00:00:00Z", is_anonymous: false, author_name: "N", reports_count: 1 }, "removed")
    expect(video).toMatchObject({ tab: "videos", heading: "T", list: "removed", place: { kind: "recording", id: "r" } })
  })
  it("maps errors", () => {
    expect(reviewFailureFromError(new NetworkError())).toBe("network")
    expect(reviewFailureFromError(new RemoteError(403, "x"))).toBe("denied")
    expect(reviewFailureFromError(new RemoteError(404, "x"))).toBe("gone")
    expect(reviewFailureFromError(new RemoteError(409, "x"))).toBe("conflict")
    expect(reviewFailureFromError(new RemoteError(422, "x"))).toBe("reasonNeeded")
    expect(reviewFailureFromError(new RemoteError(500, "x"))).toBe("server")
  })
})

describe("the real backend against a fake server", () => {
  const run = async (work: (api: ReturnType<typeof teamReviewRemote>) => Promise<unknown>) => {
    const seen: Seen[] = []
    const api = teamReviewRemote(CFG(fakeFetch({ status: 200, body: { items: [], total: 0 } }, seen)))
    await work(api)
    return seen.map((s) => `${s.init.method} ${s.url.replace("https://api.example/api/v1", "")}`)
  }
  const base = { id: "i1", source: "video", tab: "videos", place: { kind: "song", number: 1 }, text: "", heading: null, authorName: "N", isAnonymous: false, reportsCount: 0, createdAt: "", isReply: false, reason: null, key: "k", list: "open" } as const
  it("asks each area for its own queue", async () => {
    expect(await run((api) => api.list("sheets", "open"))).toEqual(["GET /recording-chords/review/queue?filter=pending&limit=50"])
    expect(await run((api) => api.list("sheets", "removed"))).toEqual(["GET /recording-chords/review/queue?filter=rejected&limit=50"])
    expect(await run((api) => api.list("videos", "open"))).toEqual(["GET /video-links/review?filter=reported&limit=50"])
    expect(await run((api) => api.list("comments", "removed"))).toEqual([
      "GET /song-comments/review?filter=removed&limit=50",
      "GET /recording-comments/review?filter=removed&limit=50",
    ])
  })
  it("counts the open lists for the badges", async () => {
    const calls = await run((api) => api.counts())
    expect(calls).toHaveLength(4)
  })
  it("approve, remove and restore go to the right address", async () => {
    expect(await run((api) => api.act({ ...base }, "approve"))).toEqual(["POST /video-links/i1/keep"])
    expect(await run((api) => api.act({ ...base }, "remove", " spam "))).toEqual(["DELETE /video-links/i1"])
    expect(await run((api) => api.act({ ...base, list: "removed" }, "restore"))).toEqual(["POST /video-links/i1/restore"])
    expect(await run((api) => api.act({ ...base, source: "songComment", tab: "comments" }, "approve"))).toEqual(["POST /song-comments/i1/keep"])
    expect(await run((api) => api.act({ ...base, source: "recordingComment", tab: "comments" }, "restore"))).toEqual(["POST /recording-comments/i1/restore"])
    expect(await run((api) => api.act({ ...base, source: "recordingSheet", tab: "sheets" }, "approve"))).toEqual(["POST /recording-chords/review/i1/approve"])
    expect(await run((api) => api.act({ ...base, source: "recordingSheet", tab: "sheets" }, "remove", "Wrong chords"))).toEqual(["POST /recording-chords/review/i1/reject"])
  })
})

describe("the preview's in-memory desk", () => {
  it("lists, counts, approves, removes with a reason, restores", async () => {
    const desk = createTeamReviewMock()
    const counts = await desk.counts()
    expect(counts).toEqual({ sheets: 2, comments: 2, videos: 1 })
    const waiting = (await desk.list("sheets", "open")).items
    await desk.act(waiting[0]!, "approve")
    expect((await desk.counts()).sheets).toBe(1)
    const rest = (await desk.list("sheets", "open")).items[0]!
    await expect(desk.act(rest, "remove", "no")).rejects.toMatchObject({ status: 422 })
    await desk.act(rest, "remove", "Chords do not match")
    expect((await desk.list("sheets", "removed")).items.map((i) => i.id)).toContain(rest.id)
    const removed = (await desk.list("sheets", "removed")).items.find((i) => i.id === rest.id)!
    expect(removed.reason).toBe("Chords do not match")
    await desk.act(removed, "restore")
    expect((await desk.counts()).sheets).toBe(1)
  })
  it("refuses everything to someone who is not the team, and a second decision on the same item", async () => {
    const closed = createTeamReviewMock({ team: () => false })
    await expect(closed.counts()).rejects.toMatchObject({ status: 403 })
    await expect(closed.list("videos", "open")).rejects.toMatchObject({ status: 403 })
    const desk = createTeamReviewMock()
    const video = (await desk.list("videos", "open")).items[0]!
    await desk.act(video, "approve")
    await expect(desk.act(video, "approve")).rejects.toMatchObject({ status: 404 })
  })
  it("has an empty state to show", async () => {
    const desk = createTeamReviewMock()
    for (const item of (await desk.list("videos", "open")).items) await desk.act(item, "approve")
    expect(await desk.list("videos", "open")).toEqual({ items: [], total: 0 })
  })
})
