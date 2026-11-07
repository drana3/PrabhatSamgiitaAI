import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: { webBaseUrl: "https://example.test" } } } }))

import { setActiveLanguage, t } from "@/lib/i18n"
import { addLanguage, failureOf, needsLanguage } from "@/lib/kirtan/addLanguage"
import { NetworkError, RemoteError, type RemoteConfig } from "@/lib/kirtan/remote"
import { withLanguage } from "@/lib/kirtan/submissions"
import type { Kirtan } from "@/lib/kirtan/types"
import { recordingFacts } from "@/lib/kirtan/facts"

/** "Add language" for an old Bhajan or Spiritual song stored without one. */

const k = (over: Partial<Kirtan>): Kirtan => ({ id: "a", kind: "bhajan", title: "T", author: "A", durationSec: null, type: "other", audioUrl: null, thumbnailUrl: null, addedBy: "x", status: "published", addedAt: 0, serverId: "srv-1", ...over }) as Kirtan

function cfgWith(status: number, body: unknown = {}) {
  const calls: { url: string; method?: string; body: unknown }[] = []
  const fake = (async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method, body: JSON.parse(String(init?.body)) })
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
  }) as unknown as typeof fetch
  const cfg: RemoteConfig = { baseUrl: "https://api.test/", headers: () => ({}), fetch: fake }
  return { cfg, calls }
}

describe("needsLanguage", () => {
  const owner = { mine: true, team: false }
  it("asks for a published Bhajan, Spiritual song or Baba's Audio with no language, for its uploader or the team", () => {
    for (const kind of ["bhajan", "spiritual_song", "baba_audio"] as const) {
      expect(needsLanguage(k({ kind }), owner)).toBe(true)
      expect(needsLanguage(k({ kind }), { mine: false, team: true })).toBe(true)
    }
  })
  it("does not ask anyone else, other kinds, other states, or a recording that has a language", () => {
    expect(needsLanguage(k({}), { mine: false, team: false })).toBe(false)
    for (const kind of ["kiirtan", "prabhat_samgiita", "dance_song"] as const) expect(needsLanguage(k({ kind }), owner)).toBe(false)
    for (const status of ["uploading", "failed", "removed"] as const) expect(needsLanguage(k({ status }), owner)).toBe(false)
    expect(needsLanguage(k({ language: "bn" }), owner)).toBe(false)
  })
})

describe("failureOf", () => {
  it("names each way it can fail", () => {
    expect(failureOf(new NetworkError())).toBe("network")
    expect(failureOf(new RemoteError(401, "x"))).toBe("signin")
    expect(failureOf(new RemoteError(403, "x"))).toBe("forbidden")
    expect(failureOf(new RemoteError(404, "x"))).toBe("notUp")
    expect(failureOf(new RemoteError(409, "This recording already has a language."))).toBe("already")
    expect(failureOf(new RemoteError(409, "This recording was removed."))).toBe("removed")
    expect(failureOf(new RemoteError(422, "x"))).toBe("invalid")
    expect(failureOf(new RemoteError(500, "x"))).toBe("server")
    expect(failureOf(new Error("boom"))).toBe("server")
  })
})

describe("addLanguage", () => {
  it("PATCHes /{id}/language with the code, and the name only for Other", async () => {
    const ok = cfgWith(200, { id: "srv-1" })
    expect(await addLanguage(k({}), { language: "bn" }, ok.cfg)).toMatchObject({ ok: true })
    expect(ok.calls[0]).toMatchObject({ method: "PATCH", body: { language: "bn" } })
    expect(ok.calls[0]!.url).toContain("/srv-1/language")
    expect(ok.calls[0]!.body).not.toHaveProperty("language_other")
    await addLanguage(k({}), { language: "other", languageOther: " Santali " }, ok.cfg)
    expect(ok.calls[1]!.body).toMatchObject({ language: "other", language_other: "Santali" })
  })
  it("says why when the server refuses, and sends nothing for a recording that is not on the server", async () => {
    expect(await addLanguage(k({}), { language: "bn" }, cfgWith(403, { detail: "no" }).cfg)).toEqual({ ok: false, code: "forbidden" })
    expect(await addLanguage(k({}), { language: "bn" }, cfgWith(409, { detail: "This recording already has a language." }).cfg)).toEqual({ ok: false, code: "already" })
    const none = cfgWith(200)
    expect(await addLanguage(k({ serverId: undefined }), { language: "bn" }, none.cfg)).toEqual({ ok: false, code: "notUp" })
    expect(none.calls).toHaveLength(0)
  })
})

describe("withLanguage", () => {
  it("fills a missing language by own id or server id and never rewrites an existing one", () => {
    const list = [k({ id: "a", serverId: "s1" }), k({ id: "b", serverId: "s2", language: "en" }), k({ id: "c", serverId: "s3" })]
    expect(withLanguage(list, "s1", { language: "bn" }).map((x) => x.language)).toEqual(["bn", "en", undefined])
    expect(withLanguage(list, "b", { language: "bn" })[1]!.language).toBe("en")
    expect(withLanguage(list, "c", { language: "other", languageOther: "  Santali " })[2]).toMatchObject({ language: "other", languageOther: "Santali" })
  })
})

describe("the facts line and the words", () => {
  it("lists kind, language, year, and for Baba's Audio the place and discourse", () => {
    setActiveLanguage("en")
    const tt = t as unknown as (key: string, vars?: Record<string, string | number>) => string
    expect(recordingFacts(k({ language: "bn", year: 1982 }), tt)).toEqual(["Bhajan", "Bengali", "1982"])
    const baba = recordingFacts(k({ kind: "baba_audio", language: "en", place: "Ranchi", discourse: "12" }), tt)
    expect(baba).toEqual(["Baba's Audio Discourses", "English", "Given in Ranchi", "Discourse: 12"])
    expect(recordingFacts(k({ kind: "kiirtan", language: "bn" }), tt)).toEqual(["Kiirtan"])
  })
  it("has every key in en, ru and es", () => {
    const source = readFileSync(join(__dirname, "..", "locales", "recordings.ts"), "utf8")
    const keys = ["title", "body", "button", "saving", "done", "short", "error.network", "error.signin", "error.notUp", "error.forbidden", "error.already", "error.removed", "error.invalid", "error.server"].map((x) => `rec.addLang.${x}`)
    for (const key of [...keys, "rec.fact.place", "rec.fact.discourse", "rec.fact.dance"]) expect(source.split(`"${key}"`).length - 1, key).toBe(3)
    const ru = readFileSync(join(__dirname, "..", "locales", "recordings.ts"), "utf8")
    expect(ru).not.toMatch(/"rec\.addLang\.[^"]+": "[^"]*(Bhajan|Kiirtan)/)
  })
})
