import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

import { createAnalytics, noopAnalytics, type AnalyticsMode } from "@/lib/analytics/client"
import { EVENT_SPEC, MAX_PROPS, isEventName, sanitizeProps } from "@/lib/analytics/events"
import { normalizeAnalyticsMode } from "@/stores/analyticsConsentStore"

function setup(opts: { mode?: AnalyticsMode; status?: number; endpoint?: string | undefined } = {}) {
  let mode: AnalyticsMode = opts.mode ?? "anonymous"
  const calls: { url: string; body: Record<string, unknown> }[] = []
  const timers: (() => void)[] = []
  const fetchFake = vi.fn(async (url: string, init: { body: string }) => {
    calls.push({ url, body: JSON.parse(init.body) })
    return { status: opts.status ?? 202 } as Response
  })
  const analytics = createAnalytics({
    endpoint: "endpoint" in opts ? opts.endpoint : "https://api.test/api/v1/events",
    fetch: fetchFake as unknown as typeof fetch,
    mode: () => mode,
    installId: async () => "install-abc",
    sessionId: "0123456789abcdef-0123",
    appVersion: "1.2.3",
    platform: "ios",
    language: () => "en",
    later: (fn) => {
      timers.push(fn)
      return () => undefined
    },
  })
  return { analytics, calls, fetchFake, timers, setMode: (m: AnalyticsMode) => (mode = m) }
}

describe("sanitizeProps", () => {
  it("keeps listed props with safe values and drops everything else", () => {
    expect(sanitizeProps("search", { mode: "voice", has_results: true, results: 12, query: "my secret" })).toEqual({
      mode: "voice",
      has_results: true,
      results: 12,
    })
  })

  it("drops free text, e-mails, uppercase and long strings", () => {
    expect(sanitizeProps("search", { mode: "dada@example.com" })).toEqual({})
    expect(sanitizeProps("search", { mode: "Some Song Title" })).toEqual({})
    expect(sanitizeProps("search", { mode: "a".repeat(41) })).toEqual({})
  })

  it("drops fractions and huge numbers", () => {
    expect(sanitizeProps("search", { results: 1.5 })).toEqual({})
    expect(sanitizeProps("search", { results: 5_000_000 })).toEqual({})
  })

  it("never carries more than MAX_PROPS", () => {
    for (const name of Object.keys(EVENT_SPEC) as (keyof typeof EVENT_SPEC)[]) {
      const many = Object.fromEntries(EVENT_SPEC[name].map((p) => [p, "x"]))
      expect(Object.keys(sanitizeProps(name, many)).length).toBeLessThanOrEqual(MAX_PROPS)
    }
  })
})

describe("createAnalytics", () => {
  it("batches events and sends them with the session, no install id in anonymous mode", async () => {
    const { analytics, calls } = setup()
    analytics.track("app_open", { cold: true })
    analytics.track("search", { mode: "text", has_results: false })
    expect(analytics.pending()).toBe(2)
    await analytics.flush()
    expect(calls).toHaveLength(1)
    expect(calls[0].body).toMatchObject({ mode: "anonymous", session_id: "0123456789abcdef-0123", platform: "ios" })
    expect(calls[0].body).not.toHaveProperty("install_id")
    expect((calls[0].body.events as unknown[]).length).toBe(2)
    expect(analytics.pending()).toBe(0)
  })

  it("adds the install id only in shared mode", async () => {
    const { analytics, calls } = setup({ mode: "shared" })
    analytics.track("app_open", { cold: true })
    await analytics.flush()
    expect(calls[0].body.install_id).toBe("install-abc")
  })

  it("sends and queues nothing when the person chose Off", async () => {
    const { analytics, fetchFake } = setup({ mode: "off" })
    analytics.track("app_open", { cold: true })
    expect(analytics.pending()).toBe(0)
    await analytics.flush()
    expect(fetchFake).not.toHaveBeenCalled()
  })

  it("drops what is waiting if the person switches to Off before the send", async () => {
    const { analytics, fetchFake, setMode } = setup()
    analytics.track("app_open", { cold: true })
    setMode("off")
    await analytics.flush()
    expect(fetchFake).not.toHaveBeenCalled()
    expect(analytics.pending()).toBe(0)
  })

  it("does nothing without an endpoint", () => {
    const { analytics, fetchFake } = setup({ endpoint: undefined })
    analytics.track("app_open", { cold: true })
    expect(analytics.pending()).toBe(0)
    expect(fetchFake).not.toHaveBeenCalled()
  })

  it("ignores unknown events", () => {
    const { analytics } = setup()
    analytics.track("page_view" as never)
    expect(analytics.pending()).toBe(0)
  })

  it("retries once after a network failure, then gives the batch up", async () => {
    const { analytics, fetchFake } = setup()
    fetchFake.mockRejectedValue(new Error("offline"))
    analytics.track("app_open", { cold: true })
    await analytics.flush()
    expect(fetchFake).toHaveBeenCalledTimes(2)
    expect(analytics.pending()).toBe(0)
  })

  it("does not retry a 4xx", async () => {
    const { analytics, fetchFake } = setup({ status: 422 })
    analytics.track("app_open", { cold: true })
    await analytics.flush()
    expect(fetchFake).toHaveBeenCalledTimes(1)
  })

  it("schedules a flush by timer and sends when it fires", async () => {
    const { analytics, calls, timers } = setup()
    analytics.track("app_open", { cold: true })
    expect(timers).toHaveLength(1)
    timers[0]()
    await analytics.flush()
    expect(calls.length).toBeGreaterThanOrEqual(1)
  })

  it("caps the queue so a dead network cannot grow memory", () => {
    const { analytics } = setup()
    for (let i = 0; i < 300; i += 1) analytics.track("screen_view", { screen: "home" })
    expect(analytics.pending()).toBeLessThanOrEqual(100)
  })

  it("never throws, even if the settings reader throws", () => {
    const a = createAnalytics({
      endpoint: "https://x.test",
      fetch: vi.fn() as unknown as typeof fetch,
      mode: () => {
        throw new Error("boom")
      },
      installId: async () => "x",
      sessionId: "s",
      appVersion: undefined,
      platform: undefined,
      language: () => "en",
    })
    expect(() => a.track("app_open", { cold: true })).not.toThrow()
  })

  it("noopAnalytics does nothing", async () => {
    noopAnalytics.track("app_open")
    await noopAnalytics.flush()
    expect(noopAnalytics.pending()).toBe(0)
  })
})

describe("consent mode", () => {
  it("defaults anything odd to anonymous", () => {
    expect(normalizeAnalyticsMode(undefined)).toBe("anonymous")
    expect(normalizeAnalyticsMode("yes")).toBe("anonymous")
    expect(normalizeAnalyticsMode("off")).toBe("off")
    expect(normalizeAnalyticsMode("shared")).toBe("shared")
  })
})

describe("event list matches the server", () => {
  it("has the same events and properties as apps/api telemetry.py", () => {
    const py = readFileSync(join(__dirname, "../../api/app/services/telemetry.py"), "utf8")
    const block = py.slice(py.indexOf("EVENTS: dict"), py.indexOf("}\n", py.indexOf("EVENTS: dict")))
    const exposure = /EXPOSURE = "([a-z_]+)"/.exec(py)?.[1]
    const server: Record<string, string[]> = {}
    for (const m of block.matchAll(/"?([A-Za-z_]+)"?: frozenset\(\{([^}]*)\}\)/g)) {
      const name = m[1] === "EXPOSURE" ? (exposure as string) : m[1]
      server[name] = [...m[2].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]).sort()
    }
    const app = Object.fromEntries(Object.entries(EVENT_SPEC).map(([k, v]) => [k, [...v].sort()]))
    expect(server).toEqual(app)
    expect(isEventName("app_open")).toBe(true)
  })
})
