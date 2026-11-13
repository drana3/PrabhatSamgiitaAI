import { beforeEach, describe, expect, it, vi } from "vitest"

import { crashReportOptions, resetCrashReportsForTests, startCrashReports } from "@/lib/observability/crashReports"
import { scrubBreadcrumb, scrubEvent, scrubText, scrubUrl } from "@/lib/observability/scrub"

describe("scrubText", () => {
  it("hides e-mail addresses, bearer tokens, JWTs and signed-URL parts", () => {
    expect(scrubText("mail dada@example.com now")).toBe("mail [email] now")
    expect(scrubText("Authorization: Bearer abcdef1234567890")).not.toContain("abcdef1234567890")
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r"
    expect(scrubText(`token ${jwt}`)).not.toContain("eyJhbGci")
    expect(scrubText("https://r2.test/a?X-Amz-Signature=deadbeefcafe&X-Amz-Credential=KEY%2F2026")).not.toMatch(/deadbeef|KEY%2F/)
  })

  it("hides long hex strings (hashes, keys)", () => {
    expect(scrubText("key " + "a".repeat(64))).not.toContain("a".repeat(64))
  })

  it("leaves ordinary text alone", () => {
    expect(scrubText("Song 1234 failed to load")).toBe("Song 1234 failed to load")
  })
})

describe("scrubUrl", () => {
  it("drops the query string", () => {
    expect(scrubUrl("https://api.test/songs?q=secret&token=abc")).toBe("https://api.test/songs")
  })
})

describe("scrubEvent", () => {
  it("removes request data, device name, user details and stack variables", () => {
    const event = scrubEvent({
      request: { url: "https://x?token=1", headers: { cookie: "a" } },
      server_name: "Dada's iPhone",
      user: { id: "u1", email: "dada@example.com", ip_address: "1.2.3.4" },
      message: "failed for dada@example.com",
      contexts: { device: { name: "Dada's iPhone", model: "iPhone 15", device_unique_identifier: "zzz" } },
      exception: { values: [{ value: "bad dada@example.com", stacktrace: { frames: [{ filename: "a.js", vars: { pw: "x" } }] } }] },
      breadcrumbs: [{ message: "GET https://api.test/s?q=hello", data: { url: "https://api.test/s?q=hello" } }],
    }) as Record<string, any>
    expect(event.request).toBeUndefined()
    expect(event.server_name).toBeUndefined()
    expect(event.user).toEqual({ id: "u1" })
    expect(event.message).toBe("failed for [email]")
    expect(event.contexts.device.name).toBeUndefined()
    expect(event.contexts.device.device_unique_identifier).toBeUndefined()
    expect(event.contexts.device.model).toBe("iPhone 15")
    expect(event.exception.values[0].value).toBe("bad [email]")
    expect(event.exception.values[0].stacktrace.frames[0].vars).toBeUndefined()
    expect(event.breadcrumbs[0].data.url).toBe("https://api.test/s")
    expect(JSON.stringify(event)).not.toMatch(/hello|dada@example|1\.2\.3\.4/)
  })

  it("handles breadcrumbs in the { values } shape", () => {
    const event = scrubEvent({ breadcrumbs: { values: [{ message: "https://a.test/x?token=abc" }] } }) as Record<string, any>
    expect(event.breadcrumbs.values[0].message).toBe("https://a.test/x")
  })

  it("does not throw on odd input", () => {
    expect(() => scrubEvent({ extra: { loop: null }, breadcrumbs: 5 } as never)).not.toThrow()
  })
})

describe("scrubBreadcrumb", () => {
  it("cleans navigation targets", () => {
    const c = scrubBreadcrumb({ data: { from: "/a?x=1", to: "/b?email=a@b.co" } }) as Record<string, any>
    expect(c.data.from).toBe("/a")
    expect(c.data.to).toBe("/b")
  })
})

describe("crash reports", () => {
  beforeEach(() => resetCrashReportsForTests())

  it("is off without a DSN and when the person chose Off", () => {
    expect(crashReportOptions({ dsn: undefined, release: "r", environment: "production", mode: "anonymous" })).toBeNull()
    expect(crashReportOptions({ dsn: "  ", release: "r", environment: "production", mode: "anonymous" })).toBeNull()
    expect(crashReportOptions({ dsn: "https://k@o.ingest.sentry.io/1", release: "r", environment: "production", mode: "off" })).toBeNull()
  })

  it("never sends personal data by default", () => {
    const o = crashReportOptions({ dsn: "https://k@o.ingest.sentry.io/1", release: "r@1", environment: "production", mode: "shared" })!
    expect(o.sendDefaultPii).toBe(false)
    expect(o.attachScreenshot).toBe(false)
    expect(o.attachViewHierarchy).toBe(false)
    expect(o.release).toBe("r@1")
    expect(typeof o.beforeSend).toBe("function")
  })

  it("starts Sentry once and stops when switched off", () => {
    const init = vi.fn()
    const close = vi.fn(async () => true)
    const load = () => ({ init, close })
    const on = { dsn: "https://k@o.ingest.sentry.io/1", release: "r", environment: "production", mode: "anonymous" as const }
    expect(startCrashReports(on, load)).toBe(true)
    expect(startCrashReports(on, load)).toBe(true)
    expect(init).toHaveBeenCalledTimes(1)
    expect(startCrashReports({ ...on, mode: "off" }, load)).toBe(false)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it("survives a missing native module", () => {
    const on = { dsn: "https://k@o.ingest.sentry.io/1", release: "r", environment: "production", mode: "anonymous" as const }
    expect(
      startCrashReports(on, () => {
        throw new Error("no native module")
      }),
    ).toBe(false)
  })
})
