import { describe, expect, it, vi } from "vitest"

import { createFlagsClient, OFF, type FlagStorage } from "@/lib/flags/client"

function memory(initial: string | null = null): FlagStorage & { value: string | null } {
  const box = { value: initial }
  return {
    get value() {
      return box.value
    },
    get: async () => box.value,
    set: async (v) => {
      box.value = v
    },
  } as FlagStorage & { value: string | null }
}

function make(opts: { body?: unknown; ok?: boolean; reject?: boolean; storage?: FlagStorage; endpoint?: string; now?: () => number } = {}) {
  const fetchFake = vi.fn(async (_url: string, init?: { headers?: Record<string, string> }) => {
    if (opts.reject) throw new Error("offline")
    return { ok: opts.ok ?? true, json: async () => opts.body ?? { flags: {} }, headers: init?.headers } as unknown as Response
  })
  const exposures: [string, string][] = []
  const client = createFlagsClient({
    endpoint: "endpoint" in opts ? opts.endpoint : "https://api.test/api/v1/flags",
    fetch: fetchFake as unknown as typeof fetch,
    installId: async () => "install-abc",
    appVersion: "1.2.3",
    platform: "ios",
    storage: opts.storage ?? memory(),
    onExposure: (f, v) => exposures.push([f, v]),
    now: opts.now,
  })
  return { client, fetchFake, exposures }
}

describe("flags client", () => {
  it("is OFF for anything unknown", () => {
    const { client } = make()
    expect(client.get("never_heard")).toEqual(OFF)
  })

  it("asks the server with the install id, version and platform", async () => {
    const { client, fetchFake } = make({ body: { flags: { new_ui: { enabled: true, variant: "b" } } } })
    await client.refresh()
    const headers = fetchFake.mock.calls[0][1]?.headers
    expect(headers).toEqual({ "X-Install-Id": "install-abc", "X-App-Version": "1.2.3", "X-Platform": "ios" })
    expect(client.get("new_ui")).toEqual({ enabled: true, variant: "b" })
  })

  it("keeps the old answer when the network fails or the server errors", async () => {
    const a = make({ reject: true })
    await a.client.refresh()
    expect(a.client.get("x")).toEqual(OFF)
    const b = make({ ok: false })
    await b.client.refresh()
    expect(b.client.get("x")).toEqual(OFF)
  })

  it("ignores malformed flag entries", async () => {
    const { client } = make({ body: { flags: { good: { enabled: true, variant: "on" }, bad: { enabled: "yes" }, worse: 5 } } })
    await client.refresh()
    expect(client.get("good").enabled).toBe(true)
    expect(client.get("bad")).toEqual(OFF)
    expect(client.get("worse")).toEqual(OFF)
  })

  it("saves the answer and restores it on the next launch", async () => {
    const storage = memory()
    const first = make({ body: { flags: { f: { enabled: true, variant: "on" } } }, storage })
    await first.client.refresh()
    const second = make({ storage, endpoint: undefined })
    await second.client.load()
    expect(second.client.get("f")).toEqual({ enabled: true, variant: "on" })
  })

  it("survives a damaged cache", async () => {
    const { client } = make({ storage: memory("{not json") })
    await expect(client.load()).resolves.toBeUndefined()
    expect(client.get("f")).toEqual(OFF)
  })

  it("does not ask again inside the ten minute window, unless forced", async () => {
    let t = 1_000_000
    const { client, fetchFake } = make({ now: () => t })
    await client.refresh()
    t += 60_000
    await client.refresh()
    expect(fetchFake).toHaveBeenCalledTimes(1)
    t += 11 * 60_000
    await client.refresh()
    expect(fetchFake).toHaveBeenCalledTimes(2)
    await client.refresh(true)
    expect(fetchFake).toHaveBeenCalledTimes(3)
  })

  it("never asks without an endpoint", async () => {
    const { client, fetchFake } = make({ endpoint: undefined })
    await client.refresh()
    expect(fetchFake).not.toHaveBeenCalled()
  })

  it("records an exposure once per flag, only for flags the server answered", async () => {
    const { client, exposures } = make({ body: { flags: { ab: { enabled: true, variant: "b" }, dark: { enabled: false, variant: "off" } } } })
    client.use("ab") // not answered yet: no exposure
    await client.refresh()
    client.use("ab")
    client.use("ab")
    client.use("dark")
    client.use("unknown")
    expect(exposures).toEqual([
      ["ab", "b"],
      ["dark", "off"],
    ])
  })

  it("notifies subscribers when the answer arrives", async () => {
    const { client } = make({ body: { flags: { f: { enabled: true, variant: "on" } } } })
    const listener = vi.fn()
    const off = client.subscribe(listener)
    const before = client.snapshot()
    await client.refresh()
    expect(listener).toHaveBeenCalled()
    expect(client.snapshot()).toBeGreaterThan(before)
    off()
  })
})
