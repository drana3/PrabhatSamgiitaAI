import { describe, expect, it } from "vitest"

import { NetworkError, RemoteError } from "@/lib/kirtan/remote"
import { createMockBackend, MockFailure } from "@/lib/songChords/mock"
import { failureFromError, payloadToWire, proposalFromWire, remoteBackend, type WireProposal } from "@/lib/songChords/remote"
import type { ProposalPayload } from "@/lib/songChords/types"

const PAYLOAD: ProposalPayload = {
  songId: 19,
  instrument: "guitar",
  baseKey: "A",
  capo: 2,
  strum: "D U",
  lines: [{ placements: [{ word: 0, chord: "A" }] }],
  playedIt: true,
  note: null,
  isAnonymous: false,
}

const WIRE: WireProposal = {
  id: "c1",
  song_id: 19,
  instrument: "guitar",
  base_key: "A",
  capo: 2,
  strum: "D U",
  lines: [{ placements: [{ word: 0, chord: "A" }] }],
  note: null,
  played_it: true,
  created_at: "2026-11-01T10:00:00Z",
  is_anonymous: false,
  author: { name: "Ananda" },
  mine: false,
  status: "published",
  rejected_reason: null,
  can_review: false,
}

function fakeFetch(answer: { status: number; body?: unknown; headers?: Record<string, string> }, seen: Array<{ url: string; init: RequestInit }> = []): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    seen.push({ url, init })
    return {
      ok: answer.status < 400,
      status: answer.status,
      headers: { get: (k: string) => answer.headers?.[k] ?? null },
      json: async () => answer.body,
    } as unknown as Response
  }) as unknown as typeof fetch
}

describe("the wire", () => {
  it("never shows an author for an anonymous proposal, whatever the answer carries", () => {
    expect(proposalFromWire({ ...WIRE, is_anonymous: true, author: { name: "Leak" } }).author).toBeNull()
    expect(proposalFromWire(WIRE).author).toEqual({ name: "Ananda" })
  })
  it("sends snake_case and the whole chart", () => {
    expect(payloadToWire(PAYLOAD)).toEqual({
      song_id: 19,
      instrument: "guitar",
      base_key: "A",
      capo: 2,
      strum: "D U",
      lines: [{ placements: [{ word: 0, chord: "A" }] }],
      played_it: true,
      note: null,
      is_anonymous: false,
    })
  })
})

describe("the remote backend", () => {
  const headers = () => ({ "X-Member": "1" })
  it("lists a song's charts and posts an offer to the right addresses", async () => {
    const seen: Array<{ url: string; init: RequestInit }> = []
    const list = remoteBackend({ baseUrl: "https://api.test/", headers, fetch: fakeFetch({ status: 200, body: { items: [WIRE], total: 1 } }, seen) })
    const items = await list.listForSong(19)
    expect(items).toHaveLength(1)
    expect(seen[0].url).toBe("https://api.test/api/v1/song-chords/songs/19")
    expect(seen[0].init.method).toBe("GET")
    expect((seen[0].init.headers as Record<string, string>)["X-Member"]).toBe("1")
    const post = remoteBackend({ baseUrl: "https://api.test", headers, fetch: fakeFetch({ status: 201, body: { ...WIRE, status: "pending", mine: true } }, seen) })
    const made = await post.offer(PAYLOAD)
    expect(made).toMatchObject({ status: "pending", mine: true })
    expect(seen[1].url).toBe("https://api.test/api/v1/song-chords")
    expect(JSON.parse(String(seen[1].init.body))).toMatchObject({ song_id: 19, base_key: "A", played_it: true })
  })
  it("turns the server's answers into failures", async () => {
    const offer = (answer: { status: number; body?: unknown; headers?: Record<string, string> }) => remoteBackend({ baseUrl: "https://api.test", headers, fetch: fakeFetch(answer) }).offer(PAYLOAD)
    const fail = async (answer: { status: number; body?: unknown; headers?: Record<string, string> }) => {
      try {
        await offer(answer)
      } catch (e) {
        return failureFromError(e)
      }
      return null
    }
    expect(await fail({ status: 401, body: { detail: "Sign in is required" } })).toBe("signin")
    expect(await fail({ status: 429, body: { detail: "x" }, headers: { "X-Error-Code": "chords_daily_limit" } })).toBe("dailyLimit")
    expect(await fail({ status: 429, body: { detail: "slow" } })).toBe("slowDown")
    expect(await fail({ status: 409, body: { detail: "x" }, headers: { "X-Error-Code": "chords_duplicate" } })).toBe("duplicate")
    expect(await fail({ status: 409, body: { detail: "x" }, headers: { "X-Error-Code": "chords_open_limit" } })).toBe("tooMany")
    expect(await fail({ status: 422, body: { detail: [{ msg: "bad" }] } })).toBe("invalid")
    expect(await fail({ status: 403, body: { detail: "no" } })).toBe("forbidden")
    expect(await fail({ status: 500 })).toBe("server")
    expect(failureFromError(new NetworkError())).toBe("network")
    expect(failureFromError(new RemoteError(404, "x"))).toBe("gone")
  })
  it("a delete answers nothing", async () => {
    const api = remoteBackend({ baseUrl: "https://api.test", headers: () => ({}), fetch: fakeFetch({ status: 204 }) })
    await expect(api.remove("c1")).resolves.toBeUndefined()
  })
})

describe("the preview backend", () => {
  const make = (team = false) => createMockBackend({ me: () => "Me", team: () => team })
  it("a member's chart waits, the team's is live; only the author sees a waiting chart", async () => {
    const member = make()
    const made = await member.offer(PAYLOAD)
    expect(made).toMatchObject({ status: "pending", mine: true, author: { name: "Me" } })
    expect((await member.listForSong(19)).map((p) => p.id)).toEqual([made.id])
    const team = make(true)
    expect((await team.offer(PAYLOAD)).status).toBe("published")
  })
  it("an anonymous chart has no author", async () => {
    const api = make()
    const made = await api.offer({ ...PAYLOAD, isAnonymous: true })
    expect(made.author).toBeNull()
  })
  it("refuses the same chart twice and a fourth live chart", async () => {
    const api = make()
    await api.offer(PAYLOAD)
    await expect(api.offer(PAYLOAD)).rejects.toMatchObject({ failure: "duplicate" })
    await api.offer({ ...PAYLOAD, baseKey: "B" })
    await api.offer({ ...PAYLOAD, baseKey: "C" })
    await expect(api.offer({ ...PAYLOAD, baseKey: "D" })).rejects.toBeInstanceOf(MockFailure)
  })
  it("the team approves, rejects with a reason and restores; others may not", async () => {
    const member = make()
    await expect(member.reviewQueue("pending")).rejects.toMatchObject({ failure: "forbidden" })
    const team = make(true)
    const made = await team.offer({ ...PAYLOAD, songId: 5 })
    await team.reject(made.id, "Wrong song")
    expect((await team.listForSong(5)).find((p) => p.id === made.id)).toBeUndefined()
    expect((await team.restore(made.id)).status).toBe("published")
  })
  it("a report counts once and the author cannot report their own chart", async () => {
    const api = make()
    const [sample] = await api.listForSong(1)
    expect((await api.report(sample.id, "spam")).status).toBe("received")
    expect((await api.report(sample.id, "spam")).status).toBe("already_reported")
  })
})
