import { describe, expect, it } from "vitest"

import { failureFromError, NetworkError, RemoteError, sendReport, type RemoteConfig, type RemoteRecording } from "@/lib/kirtan/remote"
import { uploadSubmission, type UploadSource } from "@/lib/kirtan/upload"

const REC: RemoteRecording = {
  id: "r1", kind: "kiirtan", type: "other", title: "T", author: "A", added_by: "x", author_id: "m1", by_author: true, status: "published",
  duration_sec: null, plays: 0, audio_url: "https://cdn/r1.mp3", thumbnail_url: null, published_at: null, created_at: "2026-11-01T00:00:00Z",
}

type Call = { url: string; method: string; body: unknown }

function server(handler: (call: Call) => Response | Promise<Response>): { cfg: RemoteConfig; calls: Call[] } {
  const calls: Call[] = []
  const fetchFake = (async (url: string, init?: RequestInit) => {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body
    const call = { url: String(url), method: String(init?.method), body }
    calls.push(call)
    return handler(call)
  }) as unknown as typeof fetch
  return { cfg: { baseUrl: "https://api.test/", headers: () => ({ "X-Member": "1" }), fetch: fetchFake }, calls }
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

const source: UploadSource = { uri: "blob:x", fileName: "a.mp3", kind: "kiirtan", title: "T", author: "A", byAuthor: true }
const deps = { readBlob: async () => new Blob(["abc"], { type: "audio/mpeg" }), sha256: async () => "ff" }

const target = { key: "k1", method: "PUT", url: "https://r2.test/put", headers: {}, expires_at: "x", max_bytes: 1 }

function happy(call: Call): Response {
  if (call.url.endsWith("/uploads")) return json(200, target)
  if (call.url === "https://r2.test/put") return new Response(null, { status: 200 })
  return json(200, REC)
}

describe("upload in three steps", () => {
  it("asks for a target, sends the bytes, publishes", async () => {
    const { cfg, calls } = server(happy)
    const out = await uploadSubmission(cfg, source, deps)
    expect(out).toEqual({ status: "published", recording: REC })
    expect(calls.map((c) => c.method + " " + c.url)).toEqual(["POST https://api.test/api/v1/recordings/uploads", "PUT https://r2.test/put", "POST https://api.test/api/v1/recordings"])
    expect(calls[0].body).toMatchObject({ file_name: "a.mp3", size_bytes: 3, sha256: "ff" })
    expect(calls[2].body).toMatchObject({ key: "k1", terms_accepted: true, confirm_similar: false, by_author: true })
  })

  it("stops an exact duplicate before the bytes travel", async () => {
    const { cfg, calls } = server(() => json(409, { detail: { code: "duplicate", message: "Already here", duplicate_of: { id: "r0", kind: "kiirtan", title: "T", author: "A", audio_url: "u" } } }))
    const out = await uploadSubmission(cfg, source, deps)
    expect(out).toEqual({ status: "failed", failure: { code: "duplicate" } })
    expect(calls).toHaveLength(1)
  })

  it("asks about a similar recording, then publishes without sending the bytes twice", async () => {
    let publishes = 0
    const { cfg, calls } = server((call) => {
      if (call.url.endsWith("/uploads") || call.url === "https://r2.test/put") return happy(call)
      publishes += 1
      return publishes === 1 ? json(409, { detail: { code: "similar_recording", message: "Similar", similar: [{ id: "r0", kind: "kiirtan", title: "Old", author: "B", audio_url: "u" }] } }) : json(200, REC)
    })
    const first = await uploadSubmission(cfg, source, deps)
    expect(first).toMatchObject({ status: "similar", key: "k1" })
    const second = await uploadSubmission(cfg, { ...source, confirmSimilar: true, key: "k1" }, deps)
    expect(second.status).toBe("published")
    expect(calls.filter((c) => c.url === "https://r2.test/put")).toHaveLength(1)
    expect(calls[calls.length - 1].body).toMatchObject({ confirm_similar: true })
  })

  it("maps network loss, sign-in, size, rules mismatch and wrong format", async () => {
    const offline = server(() => {
      throw new Error("offline")
    })
    expect(await uploadSubmission(offline.cfg, source, deps)).toEqual({ status: "failed", failure: { code: "network" } })
    const signin = server(() => json(401, { detail: "no" }))
    expect(await uploadSubmission(signin.cfg, source, deps)).toEqual({ status: "failed", failure: { code: "signin" } })
    const big = server(() => json(413, { detail: "big" }))
    expect(await uploadSubmission(big.cfg, source, deps)).toEqual({ status: "failed", failure: { code: "size" } })
    const rules = server((call) => (call.url.endsWith("/uploads") || call.url === "https://r2.test/put" ? happy(call) : json(422, { detail: "Agree to the current content rules first." })))
    expect(await uploadSubmission(rules.cfg, source, deps)).toEqual({ status: "failed", failure: { code: "rules" } })
    const pdf = server(happy)
    expect(await uploadSubmission(pdf.cfg, { ...source, fileName: "a.pdf" }, deps)).toEqual({ status: "failed", failure: { code: "format" } })
    expect(pdf.calls).toHaveLength(0)
  })
})

describe("report", () => {
  it("posts the reason and a trimmed comment to the recording", async () => {
    const { cfg, calls } = server(() => json(200, { status: "received", message: "ok" }))
    const out = await sendReport(cfg, "r1", { reason: "copyright", comment: "  mine  " })
    expect(out.status).toBe("received")
    expect(calls[0]).toMatchObject({ method: "POST", url: "https://api.test/api/v1/recordings/r1/report", body: { reason: "copyright", comment: "mine" } })
    await sendReport(cfg, "r1", { reason: "other", comment: "   " })
    expect(calls[1].body).toEqual({ reason: "other" })
  })

  it("an error from the server is a RemoteError with its status", async () => {
    const { cfg } = server(() => json(404, { detail: "gone" }))
    await expect(sendReport(cfg, "r1", { reason: "other" })).rejects.toBeInstanceOf(RemoteError)
  })
})

describe("failureFromError", () => {
  it("reads codes and statuses", () => {
    expect(failureFromError(new NetworkError())).toEqual({ code: "network" })
    expect(failureFromError(new RemoteError(409, "m", { code: "removed_duplicate" }))).toEqual({ code: "removedDuplicate" })
    expect(failureFromError(new RemoteError(500, "boom"))).toEqual({ code: "server", message: "boom" })
  })
})
