import { describe, expect, it } from "vitest"

import { RemoteError, type RemoteConfig } from "@/lib/kirtan/remote"
import { attachTrack, createSet, deleteSet, fetchMySets, fetchPublicSets, fetchSet, finishSet, patchSet, patchTrackOnServer, removeTrackFromSet, reorderSet } from "@/lib/kirtan/remoteSets"
import { viewOfRemote } from "@/lib/kirtan/setView"

type Call = { url: string; method: string; body: unknown }
const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } })

function server(handler: (call: Call) => Response) {
  const calls: Call[] = []
  const fetchFake = (async (url: string, init?: RequestInit) => {
    const call = { url: String(url), method: String(init?.method), body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined }
    calls.push(call)
    return handler(call)
  }) as unknown as typeof fetch
  const cfg: RemoteConfig = { baseUrl: "https://api.test/", headers: () => ({ "X-Member": "1" }), fetch: fetchFake }
  return { cfg, calls }
}

const SET = {
  id: "s1", title: "Retreat", description: null, place: "Ranchi", starts_on: "2026-11-02", ends_on: null, cover_url: null, owner_id: "m1", owner_name: "Priya",
  default_kind: "kiirtan", default_language: null, default_language_other: null, default_dance: null, tracks_expected: 2, tracks_count: 1, state: "uploading", finished_at: null, created_at: "2026-11-02T00:00:00Z",
}
const REC = (id: string, status = "published") => ({
  id, kind: "kiirtan", type: "other", title: id, author: "Priya", added_by: "x", author_id: "m1", by_author: true, status, duration_sec: null, plays: 0,
  audio_url: `https://cdn/${id}.mp3`, thumbnail_url: null, published_at: null, created_at: "2026-11-02T00:00:00Z",
})
const BASE = "https://api.test/api/v1/recording-sets"

describe("calls of the playlist API", () => {
  it("create sends the client's id, the details trimmed, and an empty text clears an optional field", async () => {
    const { cfg, calls } = server(() => json(200, SET))
    await createSet(cfg, { id: "s1", title: "  Retreat ", startsOn: "2026-11-02", endsOn: "", place: "  ", description: "x", defaultKind: "dance_song", defaultDance: "tandava", tracksExpected: 12 })
    expect(calls[0]).toMatchObject({ method: "POST", url: BASE })
    expect(calls[0]!.body).toEqual({ id: "s1", title: "Retreat", starts_on: "2026-11-02", ends_on: null, place: null, description: "x", default_kind: "dance_song", default_dance: "tandava", tracks_expected: 12 })
  })

  it("patch sends only what changed", async () => {
    const { cfg, calls } = server(() => json(200, SET))
    await patchSet(cfg, "s1", { title: "New" })
    expect(calls[0]).toMatchObject({ method: "PATCH", url: `${BASE}/s1`, body: { title: "New" } })
  })

  it("finish, order, attach, track patch and take out go to the right addresses", async () => {
    const { cfg, calls } = server((call) => (call.url.endsWith("/tracks/r1") && call.method === "PATCH" ? json(200, REC("r1")) : json(200, { ...SET, tracks: [REC("r1")] })))
    await finishSet(cfg, "s1")
    await reorderSet(cfg, "s1", ["r2", "r1"])
    await attachTrack(cfg, "s1", "r3", 2)
    await attachTrack(cfg, "s1", "r4")
    await patchTrackOnServer(cfg, "s1", "r1", { title: " Dawn ", recordedOn: null })
    await removeTrackFromSet(cfg, "s1", "r1")
    expect(calls.map((c) => `${c.method} ${c.url.replace(BASE, "")}`)).toEqual(["POST /s1/finish", "PUT /s1/order", "POST /s1/tracks", "POST /s1/tracks", "PATCH /s1/tracks/r1", "DELETE /s1/tracks/r1"])
    expect(calls[1]!.body).toEqual({ recording_ids: ["r2", "r1"] })
    expect(calls[2]!.body).toEqual({ recording_id: "r3", position: 2 })
    expect(calls[3]!.body).toEqual({ recording_id: "r4" })
    expect(calls[4]!.body).toEqual({ title: "Dawn", recorded_on: null })
  })

  it("delete says what happens to the recordings", async () => {
    const { cfg, calls } = server(() => new Response(null, { status: 204 }))
    await deleteSet(cfg, "s1", "keep")
    await deleteSet(cfg, "s1", "remove")
    expect(calls.map((c) => `${c.method} ${c.url.replace(BASE, "")}`)).toEqual(["DELETE /s1?tracks=keep", "DELETE /s1?tracks=remove"])
  })

  it("lists: public with paging, the member's own, one set", async () => {
    const { cfg, calls } = server((call) => (call.url.endsWith("/s1") ? json(200, { ...SET, tracks: [] }) : json(200, { items: [SET], total: 1 })))
    await fetchPublicSets(cfg, { limit: 20, offset: 40 })
    await fetchPublicSets(cfg)
    await fetchMySets(cfg)
    await fetchSet(cfg, "s1")
    expect(calls.map((c) => `${c.method} ${c.url.replace(BASE, "")}`)).toEqual(["GET ?limit=20&offset=40", "GET ", "GET /mine", "GET /s1"])
  })

  it("the server's refusals reach the caller with their code", async () => {
    const { cfg } = server(() => json(429, { detail: "too many" }, { "X-Error-Code": "set_start_limit" }))
    await expect(createSet(cfg, { id: "s1", title: "T", startsOn: "2026-11-02", defaultKind: "kiirtan" })).rejects.toMatchObject({ status: 429, code: "set_start_limit" })
    const full = server(() => json(409, { detail: { code: "set_full", message: "full" } }))
    await expect(attachTrack(full.cfg, "s1", "r1")).rejects.toBeInstanceOf(RemoteError)
    await expect(attachTrack(full.cfg, "s1", "r1")).rejects.toMatchObject({ status: 409, code: "set_full" })
  })
})

describe("the view of the server's answer", () => {
  it("shows only live tracks, in the server's order, and knows the owner", () => {
    const detail = { ...SET, state: "published", tracks_count: 2, tracks: [REC("r2"), REC("r1", "removed"), REC("r3")] } as never
    const owned = viewOfRemote(detail, "m1")
    expect(owned.tracks.map((t) => t.serverId)).toEqual(["r2", "r3"])
    expect(owned).toMatchObject({ owner: true, ownerName: "Priya", state: "published", source: "server" })
    expect(viewOfRemote(detail, "m2").owner).toBe(false)
    expect(viewOfRemote(detail, null).owner).toBe(false)
  })
})
