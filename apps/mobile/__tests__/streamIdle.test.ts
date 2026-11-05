import { afterEach, describe, expect, it, vi } from "vitest"

import { createApiClient } from "@prabhat/core"

const realFetch = globalThis.fetch

function hangingStream(signal: AbortSignal | undefined, firstChunk?: string) {
  let sent = false
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: () =>
          new Promise((resolve, reject) => {
            if (firstChunk && !sent) {
              sent = true
              resolve({ done: false, value: new TextEncoder().encode(firstChunk) })
              return
            }
            // nothing more arrives; only an abort ends the wait
            signal?.addEventListener("abort", () => reject(new Error("aborted")))
          }),
      }),
    },
  }
}

describe("assistant answer stream", () => {
  afterEach(() => {
    globalThis.fetch = realFetch
    vi.useRealTimers()
  })

  it("ends with an error when the connection goes silent after the first text", async () => {
    vi.useFakeTimers()
    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) =>
      hangingStream(init?.signal ?? undefined, "data: Hello\n\n"),
    ) as unknown as typeof fetch
    const chunks: string[] = []
    const client = createApiClient({ baseUrl: "https://api.example.test" })
    const run = client.streamExplanation(1, (c) => chunks.push(c), "What is this song about?")
    const settled = run.then(() => "done", (error: Error) => error.message)
    await vi.advanceTimersByTimeAsync(46_000)
    expect(await settled).toBe("aborted")
    expect(chunks).toEqual(["Hello"])
  })

  it("stops when the caller aborts", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) =>
      hangingStream(init?.signal ?? undefined),
    ) as unknown as typeof fetch
    const controller = new AbortController()
    const client = createApiClient({ baseUrl: "https://api.example.test" })
    const run = client.streamExplanation(1, () => undefined, "What is this song about?", [], controller.signal)
    const settled = run.then(() => "done", (error: Error) => error.message)
    await new Promise((resolve) => setTimeout(resolve, 10))
    controller.abort()
    expect(await settled).toBe("aborted")
  })

  it("throws the server's error code on a failed request and reports a notice code on a 200", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("slow down", { status: 429, headers: { "x-error-code": "rate_limited" } }),
    ) as unknown as typeof fetch
    let client = createApiClient({ baseUrl: "https://api.example.test" })
    const failed = await client.streamExplanation(1, () => undefined, "What is this song about?").catch((error: { code: string; status: number }) => error)
    expect(failed).toMatchObject({ code: "rate_limited", status: 429 })

    globalThis.fetch = vi.fn().mockResolvedValue(new Response("data: Song not found.\n\n", { status: 200, headers: { "x-error-code": "song_not_found" } })) as unknown as typeof fetch
    client = createApiClient({ baseUrl: "https://api.example.test" })
    const codes: string[] = []
    await client.streamExplanation(1, () => undefined, "What is this song about?", [], undefined, (code) => codes.push(code))
    expect(codes).toEqual(["song_not_found"])

    globalThis.fetch = vi.fn().mockResolvedValue(new Response("boom", { status: 502 })) as unknown as typeof fetch
    client = createApiClient({ baseUrl: "https://api.example.test" })
    const bare = await client.streamExplanation(1, () => undefined, "What is this song about?").catch((error: { code: string }) => error)
    expect(bare).toMatchObject({ code: "http_502" })
  })
})
