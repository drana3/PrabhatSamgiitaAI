import { describe, expect, it, vi } from "vitest"

import { DEMO_AUTHORS } from "@/lib/fixtures/authors"

vi.mock("@/lib/fixtures/authorsGate", () => ({ sampleAuthors: () => DEMO_AUTHORS }))

import { createDemoApi } from "@/lib/authors/demo"
import { createAuthorsApi } from "@/lib/authors/remote"
import { canPick, clock } from "@/lib/authors/claims"
import { errorKey } from "@/lib/authors/slug"

const INPUT = { slug: "priya-devi", display_name: "Priya Devi", author_type: "solo" as const, bio: "", about: "", country: null, city: null, languages: [], links: [], claimed_name: null, include_uploads: "all" as const, show_stats: true, publish: true }

async function demoWithPage(verified = false) {
  const api = createDemoApi()
  await api.create(INPUT)
  // setMine starts from a blank page, so the fields that matter are given again
  if (verified) api.control.setMine({ slug: INPUT.slug, display_name: INPUT.display_name, status: "published", verified: true })
  return api
}

describe("claim my recordings, demo", () => {
  it("suggests the same-name and the alike recordings, not other people's", async () => {
    const api = await demoWithPage()
    const s = await api.claimSuggestions()
    expect(s.same.map((c) => c.recording.id).sort()).toEqual(["lib-1", "lib-2", "lib-3"])
    expect(s.alike.map((c) => c.recording.id)).toEqual(["lib-4"])
    expect(s.total).toBe(4)
    expect(s.names).toEqual(["Priya Devi"])
  })

  it("sends everything to the team while the page is not verified, and says why", async () => {
    const api = await demoWithPage(false)
    const done = await api.createClaims(["lib-1"])
    expect(done).toMatchObject({ approved: 0, pending: 1 })
    expect(done.results[0]).toMatchObject({ outcome: "pending", team_reason: "unverified_page" })
  })

  it("approves a clear same-name solo credit at once on a verified page, but not a group credit or a look-alike", async () => {
    const api = await demoWithPage(true)
    const done = await api.createClaims(["lib-1", "lib-3", "lib-4"])
    expect(done.approved).toBe(1)
    expect(done.results.map((r) => [r.recording_id, r.outcome, r.team_reason])).toEqual([
      ["lib-1", "approved", null],
      ["lib-3", "pending", "group_credit"],
      ["lib-4", "pending", "not_same_name"],
    ])
  })

  it("does not claim twice and takes a request back", async () => {
    const api = await demoWithPage()
    await api.createClaims(["lib-2"])
    expect((await api.createClaims(["lib-2"])).results[0]!.outcome).toBe("already_pending")
    const mine = await api.myClaims()
    expect(mine.items).toHaveLength(1)
    await api.withdrawClaim(mine.items[0]!.id)
    expect((await api.myClaims("withdrawn")).items).toHaveLength(1)
    expect((await api.claimSummary()).pending).toBe(0)
    await expect(api.withdrawClaim(mine.items[0]!.id)).rejects.toMatchObject({ code: "claim_closed" })
  })

  it("a name added as 'written another way' widens the suggestions, and it can be removed", async () => {
    const api = await demoWithPage()
    const before = (await api.claimSuggestions()).total
    const added = await api.addAlias("Radha Songs")
    expect(added).toHaveLength(1)
    expect((await api.claimSuggestions()).total).toBe(before + 1)
    await api.removeAlias(added[0]!.key)
    expect((await api.claimSuggestions()).total).toBe(before)
  })

  it("caps the names at five and refuses an empty one", async () => {
    const api = await demoWithPage()
    await expect(api.addAlias("  ")).rejects.toMatchObject({ code: "alias_invalid" })
    for (const n of ["A One", "B Two", "C Three", "D Four", "E Five"]) await api.addAlias(n)
    await expect(api.addAlias("F Six")).rejects.toMatchObject({ code: "alias_limit" })
  })

  it("finds by credit and by a word in the title; a title match is the weakest level", async () => {
    const api = await demoWithPage()
    const found = await api.claimSearch("priya")
    const levels = Object.fromEntries(found.items.map((c) => [c.recording.id, c.level]))
    expect(levels["lib-1"]).toBe("alike")
    expect(levels["lib-5"]).toBe("title")
    expect((await api.claimSearch("p")).items).toEqual([])
  })

  it("an empty library has nothing to suggest", async () => {
    const api = await demoWithPage()
    api.control.setClaimLibrary("none")
    expect((await api.claimSuggestions()).total).toBe(0)
  })
})

describe("claim my recordings, screen helpers", () => {
  it("only a recording with no live request can be chosen", () => {
    const base = { recording: {} as never, level: "same" as const, matched_text: "", route: "team" as const, team_reason: null, claim_id: null }
    expect(canPick({ ...base, claim_status: null })).toBe(true)
    expect(canPick({ ...base, claim_status: "withdrawn" })).toBe(true)
    for (const status of ["pending", "approved", "rejected", "revoked"] as const) expect(canPick({ ...base, claim_status: status })).toBe(false)
  })

  it("writes a length as minutes and seconds", () => {
    expect(clock(1264)).toBe("21:04")
    expect(clock(65)).toBe("1:05")
    expect(clock(null)).toBe("")
  })

  it("maps every claim error code to a sentence", () => {
    for (const code of ["claims_waiting", "claim_closed", "alias_taken", "alias_limit"]) {
      expect(errorKey({ code })).not.toBe("authors.error.generic")
    }
  })
})

describe("claim my recordings, remote client", () => {
  function server(body: unknown = {}) {
    const calls: { url: string; method: string; body?: string }[] = []
    const fetchFake = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method ?? "GET", body: init?.body as string | undefined })
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
    }) as typeof fetch
    return { calls, cfg: { baseUrl: "https://api.example/", headers: () => ({}), fetch: fetchFake } }
  }

  it("asks the right addresses with the right bodies", async () => {
    const s = server({ items: [], total: 0 })
    const api = createAuthorsApi(s.cfg)
    await api.claimSummary()
    await api.claimSuggestions()
    await api.claimSearch("  Priya D ", 30)
    await api.createClaims(["a", "b"])
    await api.myClaims("pending")
    await api.aliases()
    await api.addAlias("Priya D.")
    expect(s.calls.map((c) => `${c.method} ${c.url.replace("https://api.example/api/v1", "")}`)).toEqual([
      "GET /authors/me/claims/summary",
      "GET /authors/me/claims/suggestions",
      "GET /authors/me/claims/search?q=Priya%20D&limit=30&offset=30",
      "POST /authors/me/claims",
      "GET /authors/me/claims?status=pending",
      "GET /authors/me/aliases",
      "POST /authors/me/aliases",
    ])
    expect(JSON.parse(s.calls[3]!.body!)).toEqual({ recording_ids: ["a", "b"] })
    expect(JSON.parse(s.calls[6]!.body!)).toEqual({ alias: "Priya D." })
  })
})
