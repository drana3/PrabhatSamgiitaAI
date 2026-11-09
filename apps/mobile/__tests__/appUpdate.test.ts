import { describe, expect, it, vi } from "vitest"

import {
  OK,
  bannerDismissed,
  checkForUpdate,
  dismissBanner,
  safeStoreUrl,
  storeTarget,
  type UpdateDeps,
} from "@/lib/appUpdate/policy"
import { appUpdateEn, appUpdateEs, appUpdateRu } from "@/locales/appUpdate"

function memoryStorage(seed: Record<string, string> = {}) {
  const data = { ...seed }
  return {
    data,
    get: async (key: string) => data[key] ?? null,
    set: async (key: string, value: string) => {
      data[key] = value
    },
  }
}

function deps(over: Partial<UpdateDeps> = {}): UpdateDeps & { storage: ReturnType<typeof memoryStorage> } {
  return {
    endpoint: "https://api.example.test/api/v1/app/version-status",
    fetch: vi.fn() as unknown as typeof fetch,
    appVersion: "2.0.0",
    platform: "ios",
    storage: memoryStorage(),
    ...over,
  } as UpdateDeps & { storage: ReturnType<typeof memoryStorage> }
}

function reply(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
}

describe("checkForUpdate", () => {
  it("asks with the platform and the version of THIS build", async () => {
    const fetchMock = reply({ status: "ok" })
    await checkForUpdate(deps({ fetch: fetchMock }))
    const url = new URL((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string)
    expect(url.searchParams.get("platform")).toBe("ios")
    expect(url.searchParams.get("version")).toBe("2.0.0")
  })

  it("passes on the server's decision", async () => {
    const answer = await checkForUpdate(
      deps({
        fetch: reply({
          status: "required",
          minimum_version: "2.1.0",
          recommended_version: "2.2.0",
          store_url: "https://apps.apple.com/app/id123",
        }),
      }),
    )
    expect(answer).toEqual({
      status: "required",
      minimumVersion: "2.1.0",
      recommendedVersion: "2.2.0",
      storeUrl: "https://apps.apple.com/app/id123",
    })
  })

  it("never asks in a preview build or without a version", async () => {
    const fetchMock = reply({ status: "required" })
    expect(await checkForUpdate(deps({ endpoint: undefined, fetch: fetchMock }))).toEqual(OK)
    expect(await checkForUpdate(deps({ appVersion: undefined, fetch: fetchMock }))).toEqual(OK)
    expect(await checkForUpdate(deps({ platform: undefined, fetch: fetchMock }))).toEqual(OK)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("a network error, a server error or junk means ok, never a lock-out", async () => {
    const down = vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch
    expect((await checkForUpdate(deps({ fetch: down }))).status).toBe("ok")
    expect((await checkForUpdate(deps({ fetch: reply({}, 500) }))).status).toBe("ok")
    expect((await checkForUpdate(deps({ fetch: reply({ status: "banana" }) }))).status).toBe("ok")
    expect((await checkForUpdate(deps({ fetch: reply("text") }))).status).toBe("ok")
  })

  it("a standing stop stays even when the server cannot be reached", async () => {
    const shared = deps({ fetch: reply({ status: "required", minimum_version: "2.1.0" }) })
    expect((await checkForUpdate(shared)).status).toBe("required")
    const offline = { ...shared, fetch: vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch }
    expect((await checkForUpdate(offline)).status).toBe("required")
    const broken = { ...shared, fetch: reply({}, 503) }
    expect((await checkForUpdate(broken)).status).toBe("required")
  })

  it("the saved stop is dropped once the app has been updated", async () => {
    const old = deps({ fetch: reply({ status: "required" }) })
    await checkForUpdate(old)
    const updated = {
      ...old,
      appVersion: "2.1.0",
      fetch: vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch,
    }
    expect((await checkForUpdate(updated)).status).toBe("ok")
  })

  it("the server lifting the minimum lifts the stop at once", async () => {
    const shared = deps({ fetch: reply({ status: "required" }) })
    await checkForUpdate(shared)
    expect((await checkForUpdate({ ...shared, fetch: reply({ status: "ok" }) })).status).toBe("ok")
    const offline = { ...shared, fetch: vi.fn().mockRejectedValue(new Error("x")) as unknown as typeof fetch }
    expect((await checkForUpdate(offline)).status).toBe("ok")
  })

  it("a soft warning is not remembered as a stop", async () => {
    const shared = deps({ fetch: reply({ status: "recommended", recommended_version: "2.2.0" }) })
    await checkForUpdate(shared)
    const offline = { ...shared, fetch: vi.fn().mockRejectedValue(new Error("x")) as unknown as typeof fetch }
    expect((await checkForUpdate(offline)).status).toBe("ok")
  })
})

describe("the banner", () => {
  const soft = { ...OK, status: "recommended" as const, recommendedVersion: "2.2.0" }

  it("stays hidden after being dismissed, until a newer version is recommended", async () => {
    const d = deps()
    expect(await bannerDismissed(d, soft)).toBe(false)
    await dismissBanner(d, soft)
    expect(await bannerDismissed(d, soft)).toBe(true)
    expect(await bannerDismissed(d, { ...soft, recommendedVersion: "2.3.0" })).toBe(false)
  })

  it("never hides a required stop", async () => {
    const d = deps()
    await dismissBanner(d, soft)
    expect(await bannerDismissed(d, { ...soft, status: "required" })).toBe(false)
  })
})

describe("store link", () => {
  it("only opens https links to a store", () => {
    expect(safeStoreUrl("https://apps.apple.com/app/id1")).toBe("https://apps.apple.com/app/id1")
    expect(safeStoreUrl("https://play.google.com/store/apps/details?id=x")).not.toBeNull()
    for (const bad of [
      "http://apps.apple.com/x",
      "https://evil.example/apps.apple.com",
      "https://apps.apple.com.evil.example/",
      "https://u@apps.apple.com/",
      "javascript:alert(1)",
      "itms-apps://x",
      42,
      null,
    ]) {
      expect(safeStoreUrl(bad)).toBeNull()
    }
  })

  it("a link from the server is dropped when it is not a store link", async () => {
    const answer = await checkForUpdate(
      deps({ fetch: reply({ status: "required", store_url: "https://evil.example/x" }) }),
    )
    expect(answer.storeUrl).toBeNull()
  })

  it("falls back to Google Play for our package on Android, and to nothing on iOS", () => {
    expect(storeTarget(OK, "android", "net.example.app")).toBe(
      "https://play.google.com/store/apps/details?id=net.example.app",
    )
    expect(storeTarget(OK, "ios", "net.example.app")).toBeNull()
    expect(storeTarget({ ...OK, storeUrl: "https://apps.apple.com/app/id1" }, "ios", "x")).toBe(
      "https://apps.apple.com/app/id1",
    )
  })
})

describe("texts", () => {
  it("English, Russian and Spanish have the same keys, all filled", () => {
    const en = Object.keys(appUpdateEn).sort()
    expect(Object.keys(appUpdateRu).sort()).toEqual(en)
    expect(Object.keys(appUpdateEs).sort()).toEqual(en)
    for (const dictionary of [appUpdateEn, appUpdateRu, appUpdateEs]) {
      for (const value of Object.values(dictionary)) expect(value.trim().length).toBeGreaterThan(2)
    }
  })
})
