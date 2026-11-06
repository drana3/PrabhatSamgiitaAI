import { afterEach, describe, expect, it, vi } from "vitest"

import { createApiClient } from "./api"
import { parseDailyQuotaBody, readDailyQuota } from "./daily-quota"

const headers = (values: Record<string, string>) => new Headers(values)
const full = { "X-RateLimit-Limit": "15", "X-RateLimit-Remaining": "11", "X-RateLimit-Reset": "3600" }

describe("readDailyQuota", () => {
  it("reads the three headers", () => {
    expect(readDailyQuota(headers(full))).toEqual({ limit: 15, remaining: 11, resetSeconds: 3600 })
    expect(readDailyQuota(headers({ ...full, "X-RateLimit-Remaining": "0" }))?.remaining).toBe(0)
  })

  it("is null when anything is missing or not a whole number", () => {
    expect(readDailyQuota(headers({}))).toBeNull()
    expect(readDailyQuota(headers({ "X-RateLimit-Limit": "15", "X-RateLimit-Remaining": "11" }))).toBeNull()
    expect(readDailyQuota(headers({ ...full, "X-RateLimit-Remaining": "ten" }))).toBeNull()
    expect(readDailyQuota(headers({ ...full, "X-RateLimit-Remaining": "-1" }))).toBeNull()
    expect(readDailyQuota(headers({ ...full, "X-RateLimit-Remaining": "1.5" }))).toBeNull()
    expect(readDailyQuota(headers({ ...full, "X-RateLimit-Remaining": "16" }))).toBeNull()
    expect(readDailyQuota(headers({ ...full, "X-RateLimit-Limit": "0", "X-RateLimit-Remaining": "0" }))).toBeNull()
  })

  it("is null for a response without headers", () => {
    expect(readDailyQuota(undefined)).toBeNull()
    expect(readDailyQuota(null)).toBeNull()
    expect(readDailyQuota({})).toBeNull()
  })
})

describe("parseDailyQuotaBody", () => {
  it("reads the JSON of GET /ai/quota", () => {
    expect(parseDailyQuotaBody({ scope: "guest", limit: 15, used: 3, remaining: 12, resets_in_seconds: 90 })).toEqual({
      limit: 15,
      remaining: 12,
      resetSeconds: 90,
    })
  })
  it("refuses anything else", () => {
    expect(parseDailyQuotaBody(null)).toBeNull()
    expect(parseDailyQuotaBody({ limit: 15 })).toBeNull()
    expect(parseDailyQuotaBody({ limit: 15, remaining: 20, resets_in_seconds: 5 })).toBeNull()
    expect(parseDailyQuotaBody({ limit: "15", remaining: 1, resets_in_seconds: 5 })).toBeNull()
  })
})

describe("the API client and the daily quota", () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })
  const client = () => createApiClient({ baseUrl: "https://api.example.test" })
  const streamResponse = (extra: Record<string, string>) => ({
    ok: true,
    status: 200,
    headers: new Headers(extra),
    body: null,
    text: async () => "data: A calm dawn song.\n\n",
  })

  it("streamExplanation hands over the allowance the server reported", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(streamResponse(full))
    const seen: unknown[] = []
    await client().streamExplanation(1, () => undefined, "Explain", [], undefined, undefined, (q) => seen.push(q))
    expect(seen).toEqual([{ limit: 15, remaining: 11, resetSeconds: 3600 }])
  })

  it("streamExplanation reports nothing when the server sent nothing", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(streamResponse({}))
    const onQuota = vi.fn()
    await client().streamExplanation(1, () => undefined, "Explain", [], undefined, undefined, onQuota)
    expect(onQuota).not.toHaveBeenCalled()
  })

  it("streamExplanation still works for callers that do not ask for the allowance", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(streamResponse(full))
    const chunks: string[] = []
    await client().streamExplanation(1, (c) => chunks.push(c), "Explain")
    expect(chunks).toEqual(["A calm dawn song."])
  })

  it("a limit notice carries code and allowance together", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(streamResponse({ ...full, "X-RateLimit-Remaining": "0", "X-Error-Code": "quota_exceeded" }))
    const codes: string[] = []
    const seen: number[] = []
    await client().streamExplanation(1, () => undefined, "Explain", [], undefined, (c) => codes.push(c), (q) =>
      seen.push(q.remaining),
    )
    expect(codes).toEqual(["quota_exceeded"])
    expect(seen).toEqual([0])
  })

  it("fetchDailyQuota reads GET /ai/quota and is null on any failure", async () => {
    const ok = new Response(JSON.stringify({ scope: "member", limit: 50, used: 2, remaining: 48, resets_in_seconds: 70 }))
    globalThis.fetch = vi.fn().mockResolvedValue(ok)
    await expect(client().fetchDailyQuota()).resolves.toEqual({ limit: 50, remaining: 48, resetSeconds: 70 })
    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe("https://api.example.test/api/v1/ai/quota")

    globalThis.fetch = vi.fn().mockResolvedValue(new Response("nope", { status: 503 }))
    await expect(client().fetchDailyQuota()).resolves.toBeNull()
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network request failed"))
    await expect(client().fetchDailyQuota()).resolves.toBeNull()
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("not json"))
    await expect(client().fetchDailyQuota()).resolves.toBeNull()
  })
})
