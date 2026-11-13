import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/mockupMode", () => ({ MOCKUP_DATA: false }))
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }))

import { pushFlagOn, pushSupportedFor } from "@/lib/push/config"
import type { RemoteConfig } from "@/lib/kirtan/remote"
import { createPushController, type PushContext } from "@/lib/push/registration"
import { getPreferences, registerDevice, setRepliesPreference, unregisterDevice } from "@/lib/push/remote"
import { pushEn, pushEs, pushRu } from "@/locales/push"

type Call = { method: string; url: string; body: unknown; headers: Record<string, string> }

function server(status = 200) {
  const calls: Call[] = []
  const fakeFetch = (async (url: string, init: { method: string; body?: string; headers: Record<string, string> }) => {
    calls.push({ method: init.method, url, body: init.body ? JSON.parse(init.body) : undefined, headers: init.headers })
    return new Response(JSON.stringify({ registered: true, replies: false, server_enabled: true }), { status })
  }) as unknown as typeof fetch
  let who = "member-a"
  const cfg = (): RemoteConfig => ({ baseUrl: "https://api.example/", headers: () => ({ "X-Member": who }), fetch: fakeFetch })
  return { calls, cfg, as: (name: string) => (who = name) }
}

const ctx = (over: Partial<PushContext> = {}): PushContext => ({ memberId: "member-a", language: "en", platform: "ios", ...over })
const TOKEN = "ExponentPushToken[abcdefghijklmnopqrstuv]"

describe("is push on in this build", () => {
  it("needs the flag, a phone and no mock data", () => {
    expect(pushFlagOn(undefined)).toBe(false)
    expect(pushFlagOn("false")).toBe(false)
    expect(pushFlagOn(" TRUE ")).toBe(true)
    expect(pushSupportedFor({ flag: true, platform: "ios", mock: false })).toBe(true)
    expect(pushSupportedFor({ flag: true, platform: "android", mock: false })).toBe(true)
    expect(pushSupportedFor({ flag: true, platform: "web", mock: false })).toBe(false)
    expect(pushSupportedFor({ flag: true, platform: "ios", mock: true })).toBe(false)
    expect(pushSupportedFor({ flag: false, platform: "ios", mock: false })).toBe(false)
  })
})

describe("the calls to the server", () => {
  it("send the token, the platform and the language, and read and write the switch", async () => {
    const s = server()
    await registerDevice(s.cfg(), { token: TOKEN, platform: "android", language: "ru" })
    await unregisterDevice(s.cfg(), TOKEN)
    expect(await getPreferences(s.cfg())).toEqual({ registered: true, replies: false, server_enabled: true })
    await setRepliesPreference(s.cfg(), false)
    expect(s.calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "PUT https://api.example/api/v1/push/devices",
      "POST https://api.example/api/v1/push/devices/unregister",
      "GET https://api.example/api/v1/push/preferences",
      "PUT https://api.example/api/v1/push/preferences",
    ])
    expect(s.calls[0].body).toEqual({ token: TOKEN, platform: "android", language: "ru" })
    expect(s.calls[1].body).toEqual({ token: TOKEN })
    expect(s.calls[3].body).toEqual({ replies: false })
  })
})

describe("keeping the server's list of phones right", () => {
  it("registers once while it should, and not again for the same member and language", async () => {
    const s = server()
    const getToken = vi.fn(async () => TOKEN)
    const c = createPushController({ config: s.cfg, getToken })
    expect(await c.reconcile(true, ctx())).toBe("registered")
    expect(await c.reconcile(true, ctx())).toBe("unchanged")
    expect(getToken).toHaveBeenCalledTimes(1)
    expect(s.calls).toHaveLength(1)
    expect(c.current()).toBe(TOKEN)
    // another language writes the push in that language
    expect(await c.reconcile(true, ctx({ language: "es" }))).toBe("registered")
    expect(s.calls[1].body).toMatchObject({ language: "es" })
  })

  it("takes the token off when it should not be woken, with the headers of the member who registered it", async () => {
    const s = server()
    const c = createPushController({ config: s.cfg, getToken: async () => TOKEN })
    await c.reconcile(true, ctx())
    s.as("nobody") // the member has signed out: the headers of the app are different now
    expect(await c.reconcile(false, ctx({ memberId: null }))).toBe("removed")
    const last = s.calls.at(-1)!
    expect(last.url).toMatch(/devices\/unregister$/)
    expect(last.headers["X-Member"]).toBe("member-a")
    expect(c.current()).toBeNull()
    expect(await c.reconcile(false, ctx({ memberId: null }))).toBe("unchanged")
  })

  it("registers again for a new member on the same phone", async () => {
    const s = server()
    const c = createPushController({ config: s.cfg, getToken: async () => TOKEN })
    await c.reconcile(true, ctx())
    s.as("member-b")
    expect(await c.reconcile(true, ctx({ memberId: "member-b" }))).toBe("registered")
    expect(s.calls.at(-1)!.headers["X-Member"]).toBe("member-b")
  })

  it("does nothing when there is no token, and never throws when the server fails", async () => {
    const none = createPushController({ config: server().cfg, getToken: async () => null })
    expect(await none.reconcile(true, ctx())).toBe("skipped")
    const down = createPushController({ config: server(500).cfg, getToken: async () => TOKEN })
    expect(await down.reconcile(true, ctx())).toBe("skipped")
    expect(down.current()).toBeNull()
    const broken = createPushController({
      config: server().cfg,
      getToken: async () => {
        throw new Error("no module")
      },
    })
    expect(await broken.reconcile(true, ctx())).toBe("skipped")
  })

  it("keeps quick changes in order", async () => {
    const s = server()
    const c = createPushController({ config: s.cfg, getToken: async () => TOKEN })
    const results = await Promise.all([c.reconcile(true, ctx()), c.reconcile(false, ctx()), c.reconcile(true, ctx())])
    expect(results).toEqual(["registered", "removed", "registered"])
    expect(s.calls.map((x) => x.url.split("/").pop())).toEqual(["devices", "unregister", "devices"])
  })
})

describe("the words of the switch", () => {
  it("exist in all three languages with the same keys", () => {
    expect(Object.keys(pushRu).sort()).toEqual(Object.keys(pushEn).sort())
    expect(Object.keys(pushEs).sort()).toEqual(Object.keys(pushEn).sort())
  })
})
