import { describe, expect, it, vi } from "vitest"

import { DEMO_AUTHORS } from "@/lib/fixtures/authors"

vi.mock("@/lib/fixtures/authorsGate", () => ({ sampleAuthors: () => DEMO_AUTHORS }))

import { createDemoApi } from "@/lib/authors/demo"
import {
  canSendProof,
  cleanCode,
  cleanProofValue,
  codeReady,
  daysUntil,
  kindsToOffer,
  needsPerson,
  proofNeedingCode,
  proofProblem,
  progress,
} from "@/lib/authors/proofs"

const INPUT = { slug: "priya-devi", display_name: "Priya Devi", author_type: "solo" as const, bio: "", about: "", country: null, city: null, languages: [], links: [], claimed_name: null, include_uploads: "all" as const, show_stats: true, publish: true }

async function demo() {
  const api = createDemoApi()
  await api.create(INPUT)
  return api
}

describe("proof text checks", () => {
  it("checks a link, an e-mail address and an empty text", () => {
    expect(proofProblem("link", "")).toBe("empty")
    expect(proofProblem("link", "youtube.com/@priya")).toBeNull()
    expect(proofProblem("link", "https://instagram.com/priya")).toBeNull()
    expect(proofProblem("link", "just words")).toBe("not_a_link")
    expect(proofProblem("email", "priya@example.org")).toBeNull()
    expect(proofProblem("email", "priya@")).toBe("not_an_email")
    expect(proofProblem("voice", "I will send a voice note")).toBeNull()
    expect(proofProblem("team", "x".repeat(501))).toBe("too_long")
  })

  it("adds https to a link and keeps the rest as typed", () => {
    expect(cleanProofValue("link", " youtube.com/@priya ")).toBe("https://youtube.com/@priya")
    expect(cleanProofValue("link", "http://a.b/c")).toBe("http://a.b/c")
    expect(cleanProofValue("email", " a@b.co ")).toBe("a@b.co")
  })

  it("keeps six digits of a code", () => {
    expect(cleanCode("12 34-56789")).toBe("123456")
    expect(codeReady("12345")).toBe(false)
    expect(codeReady("123 456")).toBe(true)
  })

  it("counts whole days, never below zero", () => {
    const now = new Date("2026-11-01T10:00:00Z")
    expect(daysUntil("2026-11-04T10:00:00Z", now)).toBe(3)
    expect(daysUntil("2026-10-30T10:00:00Z", now)).toBe(0)
    expect(daysUntil(null, now)).toBeNull()
  })
})

describe("the request, demo", () => {
  it("starts with no proof and needs one", async () => {
    const api = await demo()
    const s = await api.claimRequest()
    expect(s).toMatchObject({ stage: "no_proof", verified: false, required: 1, have: 0 })
    expect(kindsToOffer(s)).toEqual(["link", "email", "voice", "team"])
    expect(canSendProof(s)).toBe(true)
    expect(needsPerson(s)).toBe(false)
  })

  it("a link goes to the team and shows the 3 and 14 day dates", async () => {
    const api = await demo()
    await api.sendProof({ kind: "link", value: "https://youtube.com/@priya" })
    const s = await api.claimRequest()
    expect(s.stage).toBe("with_team")
    expect(s.answer_by).not.toBeNull()
    expect(s.closes_at).not.toBeNull()
    expect(kindsToOffer(s)).not.toContain("link")
  })

  it("an e-mail proof waits for its code, a wrong code is refused, the right one is kept", async () => {
    const api = await demo()
    const p = await api.sendProof({ kind: "email", value: "priya@example.org" })
    let s = await api.claimRequest()
    expect(s.stage).toBe("code")
    expect(needsPerson(s)).toBe(true)
    expect(proofNeedingCode(s)?.id).toBe(p.id)
    await expect(api.enterProofCode(p.id, "000000")).rejects.toMatchObject({ code: "code_wrong" })
    await api.enterProofCode(p.id, "123456")
    s = await api.claimRequest()
    expect(s.stage).toBe("with_team")
    expect(proofNeedingCode(s)).toBeNull()
  })

  it("withdrawing a proof frees its kind", async () => {
    const api = await demo()
    const p = await api.sendProof({ kind: "link", value: "https://x.example/a" })
    await api.withdrawProof(p.id)
    const s = await api.claimRequest()
    expect(s.stage).toBe("no_proof")
    expect(kindsToOffer(s)).toContain("link")
  })

  it("shows stages the team set: more needed, verified, with progress", async () => {
    const api = await demo()
    api.control.setProofs([{ status: "more_needed", team_note: "Please add the page link" }])
    let s = await api.claimRequest()
    expect(s.stage).toBe("need_more")
    expect(needsPerson(s)).toBe(true)
    api.control.setProofs([{ status: "ok" }])
    s = await api.claimRequest()
    expect(s).toMatchObject({ stage: "verified", verified: true })
    expect(canSendProof(s)).toBe(false)
    expect(progress({ ...s, have: 3, required: 2 })).toEqual({ have: 2, required: 2 })
  })

  it("a group page needs two proofs", async () => {
    const api = createDemoApi()
    await api.create({ ...INPUT, slug: "priya-group", display_name: "Priya & Friends", author_type: "group" })
    const s = await api.claimRequest()
    expect(s).toMatchObject({ required: 2, why_required: "group" })
  })
})

import { createDeskDemo } from "@/lib/authors/deskDemo"
import { proofActions, proofOrder } from "@/lib/authors/desk"
import { createAuthorsApi } from "@/lib/authors/remote"
import { deskRemote } from "@/lib/authors/deskRemote"
import { proofErrorKey } from "@/lib/authors/proofs"
import { RemoteError } from "@/lib/kirtan/remote"

describe("the team's proof desk", () => {
  it("lists waiting proofs, overdue first, and offers a code only for an e-mail proof", async () => {
    const desk = createDeskDemo()
    const { items } = await desk.proofs()
    const ordered = proofOrder(items)
    expect(ordered[0]!.overdue).toBe(true)
    expect(proofActions(items.find((p) => p.kind === "email")!)).toEqual(["code", "ok", "decline", "more"])
    expect(proofActions(items.find((p) => p.kind === "link")!)).toEqual(["ok", "decline", "more"])
  })

  it("accepting, declining and asking for more change the status; a finished proof has no actions", async () => {
    const desk = createDeskDemo()
    await desk.decideProof("pf1", "ok")
    await desk.decideProof("pf3", "more", { note: "Add a link" })
    const all = await desk.proofs("ok")
    expect(all.items.map((p) => p.id)).toEqual(["pf1"])
    expect(proofActions(all.items[0]!)).toEqual([])
    const waiting = await desk.proofs()
    expect(waiting.items.find((p) => p.id === "pf3")).toMatchObject({ status: "more_needed", team_note: "Add a link" })
    expect((await desk.summary()).proofs_waiting).toBe(2)
  })

  it("e-mailing the code says honestly when the server cannot send", async () => {
    expect(await createDeskDemo().sendCode("pf2")).toEqual({ sent: false })
  })

  it("the real desk asks the right addresses", async () => {
    const calls: string[] = []
    const fetchFake = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${String(input).replace("https://api.example/api/v1/admin/authors/claims", "")} ${init?.body ?? ""}`.trim())
      return new Response(JSON.stringify({ items: [], total: 0, sent: true }), { status: 200, headers: { "Content-Type": "application/json" } })
    }) as typeof fetch
    const desk = deskRemote({ baseUrl: "https://api.example/", headers: () => ({}), fetch: fetchFake })
    await desk.proofs()
    await desk.page("p/1")
    await desk.decideProof("x", "ok", { note: " fine ", approveWaiting: true })
    await desk.decideProof("x", "decline", { approveWaiting: true })
    await desk.sendCode("x")
    await desk.askMore("p1", " one more ")
    expect(calls).toEqual([
      "GET /proofs?status=waiting&limit=100",
      "GET /pages/p%2F1",
      'POST /proofs/x/ok {"note":"fine","approve_waiting":true}',
      "POST /proofs/x/decline {}",
      "POST /proofs/x/send-code {}",
      'POST /pages/p1/ask-more {"note":"one more"}',
    ])
  })
})

describe("proof error words", () => {
  it("maps the proof codes to their own sentences and leaves the rest to the usual way", () => {
    expect(proofErrorKey(new RemoteError(422, "x", { code: "code_wrong" }), () => "usual")).toBe("claimProof.error.code_wrong")
    expect(proofErrorKey(new RemoteError(500, "x", { code: null }), () => "usual")).toBe("usual")
    expect(typeof createAuthorsApi).toBe("function")
  })
})
