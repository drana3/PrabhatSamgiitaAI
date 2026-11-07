import { describe, expect, it } from "vitest"

import { createAuthorsApi, sendPlays } from "@/lib/authors/remote"
import { sampleAuthors } from "@/lib/fixtures/authorsGate"
import { createDemoApi } from "@/lib/authors/demo"
import { NetworkError, RemoteError } from "@/lib/kirtan/remote"

type Call = { url: string; method: string; body: string | undefined; headers: Record<string, string> }

function server(answer: (call: Call) => { status?: number; body?: unknown }) {
  const calls: Call[] = []
  const fetchFake = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? "GET",
      body: init?.body as string | undefined,
      headers: (init?.headers ?? {}) as Record<string, string>,
    }
    calls.push(call)
    const { status = 200, body = {} } = answer(call)
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
  }) as typeof fetch
  return { calls, cfg: { baseUrl: "https://api.example/", headers: () => ({ "X-Member": "m" }), fetch: fetchFake } }
}

describe("authors remote client", () => {
  it("asks the slug check with an encoded address and the member headers", async () => {
    const s = server(() => ({ body: { slug: "a b", available: true, problem: null, held_for_review: false, suggestions: [] } }))
    await createAuthorsApi(s.cfg).checkSlug("a b")
    expect(s.calls[0]!.url).toBe("https://api.example/api/v1/authors/slug-check?slug=a%20b")
    expect(s.calls[0]!.headers["X-Member"]).toBe("m")
  })

  it("turns a missing page of mine into 'nothing yet'", async () => {
    const s = server(() => ({ status: 404, body: { detail: { code: "no_profile", message: "none" } } }))
    expect(await createAuthorsApi(s.cfg).mine()).toEqual({ profile: null, can_create: true, suspended_reason: null })
  })

  it("keeps the error code of a refusal", async () => {
    const s = server(() => ({ status: 403, body: { detail: { code: "suspended", message: "no" } } }))
    await expect(createAuthorsApi(s.cfg).create({} as never)).rejects.toMatchObject({ status: 403, code: "suspended" })
  })

  it("reads 404, 410 and a moved address of a public page", async () => {
    const answers: Record<string, { status: number; body: unknown }> = {
      missing: { status: 404, body: {} },
      gone: { status: 410, body: {} },
      old: { status: 301, body: { detail: { code: "moved", slug: "new-name" } } },
    }
    const s = server((c) => answers[c.url.split("/").pop()!] ?? { status: 500, body: {} })
    const api = createAuthorsApi(s.cfg)
    expect(await api.profile("missing")).toEqual({ kind: "missing" })
    expect(await api.profile("gone")).toEqual({ kind: "gone" })
    expect(await api.profile("old")).toEqual({ kind: "moved", slug: "new-name" })
  })

  it("treats a redirect that fetch followed as a moved address", async () => {
    const s = server(() => ({ body: { slug: "new-name", display_name: "N" } }))
    expect(await createAuthorsApi(s.cfg).profile("old")).toEqual({ kind: "moved", slug: "new-name" })
  })

  it("reports a missing network as NetworkError", async () => {
    const cfg = {
      baseUrl: "https://api.example",
      headers: () => ({}),
      fetch: (async () => {
        throw new TypeError("offline")
      }) as typeof fetch,
    }
    await expect(createAuthorsApi(cfg).directory({})).rejects.toBeInstanceOf(NetworkError)
  })

  it("sends plays with a device id only when given one", async () => {
    const s = server(() => ({ body: { accepted: 1, duplicates: 0, rejected: {} } }))
    const event = { recording_id: "r", played_at: "2026-11-01T10:00:00Z", listened_sec: 40, duration_sec: 300 }
    await sendPlays(s.cfg, { events: [event] })
    await sendPlays(s.cfg, { events: [event], deviceId: "abcdef0123456789", region: "PL" })
    expect(JSON.parse(s.calls[0]!.body!)).toEqual({ events: [event] })
    expect(JSON.parse(s.calls[1]!.body!)).toEqual({ events: [event], device_id: "abcdef0123456789", region: "PL" })
    await expect(sendPlays(server(() => ({ status: 422, body: {} })).cfg, { events: [event] })).rejects.toBeInstanceOf(RemoteError)
  })
})

describe("demo gate", () => {
  it("shows no invented author outside the demo preview", () => {
    expect(sampleAuthors(false)).toEqual([])
    expect(sampleAuthors(true).length).toBeGreaterThan(0)
  })

  it("the demo api shows nothing at all outside the demo preview", async () => {
    const api = createDemoApi()
    expect(api.demo).toBe(true)
    expect((await api.directory({})).items).toEqual([])
  })
})
