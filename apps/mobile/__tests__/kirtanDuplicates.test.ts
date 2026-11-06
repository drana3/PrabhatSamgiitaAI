import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => {
  const memory = new Map<string, string>()
  return {
    default: {
      getItem: async (key: string) => memory.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: async (key: string) => {
        memory.delete(key)
      },
    },
  }
})
// The real wiring pulls in the whole API client; every call below passes its own config.
vi.mock("@/lib/kirtan/api", () => ({
  remoteConfig: () => ({ baseUrl: "https://api.test", headers: () => ({}) }),
  canUseServer: () => true,
}))

import { KIRTAN_FIXTURES } from "@/lib/fixtures/kirtan"
import { sampleKirtans } from "@/lib/fixtures/kirtanGate"
import { allKirtans } from "@/lib/kirtan/catalog"
import {
  cleanMantra,
  groupLocalMantras,
  localVersions,
  lookupLocalMantra,
  mantraKey,
  suggestLocalMantras,
  versionsLabel,
  versionsOfThisLabel,
  versionWord,
} from "@/lib/kirtan/mantras"
import { loadMantras, loadMantraVersions, suggestMantraTitles, versionsOfMantra } from "@/lib/kirtan/mantraSource"
import { playableOriginal } from "@/lib/kirtan/original"
import {
  discardUpload,
  failureFromError,
  fetchMantras,
  fetchMantraVersions,
  lookupMantra,
  publishRecording,
  RemoteError,
  suggestMantras,
  type RemoteConfig,
  type RemoteRecording,
} from "@/lib/kirtan/remote"
import { REPORT_REASONS, reportReasonHint, reportReasonLabel, uploadErrorText } from "@/lib/kirtan/rules"
import { buildSubmission, fromRemote } from "@/lib/kirtan/submissions"
import { discardSimilar, uploadSubmission, type UploadSource } from "@/lib/kirtan/upload"
import { setActiveLanguage } from "@/lib/i18n"
import { useKirtanStore } from "@/stores/kirtanStore"

type Call = { url: string; method: string; body: unknown }

function server(handler: (call: Call) => Response | Promise<Response>): { cfg: RemoteConfig; calls: Call[] } {
  const calls: Call[] = []
  const fetchFake = (async (url: string, init?: RequestInit) => {
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body
    const call = { url: String(url), method: String(init?.method), body }
    calls.push(call)
    return handler(call)
  }) as unknown as typeof fetch
  return { cfg: { baseUrl: "https://api.test/", headers: () => ({}), fetch: fetchFake }, calls }
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } })

const REC: RemoteRecording = {
  id: "r1", kind: "kiirtan", type: "other", title: "T", author: "A", added_by: "x", author_id: "m1", by_author: true, status: "published",
  duration_sec: null, plays: 3, audio_url: "https://cdn/r1.mp3", thumbnail_url: null, published_at: "2026-11-01T00:00:00Z", created_at: "2026-11-01T00:00:00Z",
}
const BRIEF = { id: "r0", kind: "kiirtan" as const, title: "Old one", author: "B", audio_url: "https://cdn/r0.mp3" }
const TARGET = { key: "k1", method: "PUT", url: "https://r2.test/put", headers: {}, expires_at: "x", max_bytes: 1 }
const source: UploadSource = { uri: "blob:x", fileName: "a.mp3", kind: "kiirtan", title: "T", author: "A", byAuthor: true, mantra: "Baba Nam Kevalam" }
const deps = { readBlob: async () => new Blob(["abc"], { type: "audio/mpeg" }), sha256: async () => "ff" }

function happy(call: Call): Response {
  if (call.url.endsWith("/uploads")) return json(200, TARGET)
  if (call.url === "https://r2.test/put") return new Response(null, { status: 200 })
  if (call.url.endsWith("/uploads/discard")) return new Response(null, { status: 204 })
  return json(200, REC)
}

beforeEach(() => {
  setActiveLanguage("en")
  useKirtanStore.getState().reset()
})

/* ------------------------------------------------------------------ level 1: the same file */

describe("level 1: this file is already in the library", () => {
  it("turns the API's 409 into a failure that carries the recording to listen to", () => {
    const error = new RemoteError(409, "This file is already in the library.", { code: "duplicate", duplicateOf: BRIEF })
    expect(failureFromError(error)).toEqual({ code: "duplicate", original: { id: "r0", title: "Old one", author: "B", audioUrl: "https://cdn/r0.mp3" } })
  })

  it("says so in the person's words", () => {
    expect(uploadErrorText({ code: "duplicate" })).toBe("This file is already in the library.")
    setActiveLanguage("ru")
    expect(uploadErrorText({ code: "duplicate" })).toBe("Этот файл уже есть в библиотеке.")
    setActiveLanguage("es")
    expect(uploadErrorText({ code: "duplicate" })).toBe("Este archivo ya está en la biblioteca.")
  })

  it("stops before the bytes travel, and names the recording that is there", async () => {
    const { cfg, calls } = server(() => json(409, { detail: { code: "duplicate", message: "x", duplicate_of: BRIEF } }))
    const out = await uploadSubmission(cfg, source, deps)
    expect(out).toMatchObject({ status: "failed", failure: { code: "duplicate", original: { id: "r0", title: "Old one" } } })
    expect(calls).toHaveLength(1)
  })

  it("deletes the stored file when the publish step finds the same recording after all", async () => {
    const { cfg, calls } = server((call) => {
      if (call.url === "https://api.test/api/v1/recordings") return json(409, { detail: { code: "duplicate", message: "x", duplicate_of: BRIEF } })
      return happy(call)
    })
    const out = await uploadSubmission(cfg, source, deps)
    expect(out).toMatchObject({ status: "failed", failure: { code: "duplicate" } })
    await vi.waitFor(() => expect(calls.some((c) => c.url.endsWith("/uploads/discard"))).toBe(true))
    expect(calls.find((c) => c.url.endsWith("/uploads/discard"))?.body).toEqual({ key: "k1" })
  })
})

/* ------------------------------------------------------------------ level 2: sounds like */

describe("level 2: sounds like a recording already in the library", () => {
  it("asks first, then publishes with confirm_different and without sending the bytes twice", async () => {
    let publishes = 0
    const { cfg, calls } = server((call) => {
      if (call.url === "https://api.test/api/v1/recordings") {
        publishes += 1
        return publishes === 1 ? json(409, { detail: { code: "similar_recording", message: "x", similar: [BRIEF] } }) : json(200, REC)
      }
      return happy(call)
    })
    const first = await uploadSubmission(cfg, source, deps)
    expect(first).toMatchObject({ status: "similar", key: "k1", similar: [BRIEF] })
    const second = await uploadSubmission(cfg, { ...source, confirmDifferent: true, key: "k1" }, deps)
    expect(second.status).toBe("published")
    expect(calls.filter((c) => c.url === "https://r2.test/put")).toHaveLength(1)
    expect(calls[calls.length - 1].body).toMatchObject({ confirm_different: true })
    expect(calls[calls.length - 1].body).not.toHaveProperty("confirm_similar")
  })

  it("does not say it is confirmed on the first try", async () => {
    const { cfg, calls } = server(happy)
    await uploadSubmission(cfg, source, deps)
    expect(calls[calls.length - 1].body).toMatchObject({ confirm_different: false })
  })

  it("Cancel deletes the file that already reached the server", async () => {
    const { cfg, calls } = server(happy)
    await discardSimilar(cfg, "k1")
    expect(calls).toEqual([{ url: "https://api.test/api/v1/recordings/uploads/discard", method: "POST", body: { key: "k1" } }])
  })

  it("never throws when the discard cannot be sent", async () => {
    const { cfg } = server(() => {
      throw new Error("offline")
    })
    await expect(discardSimilar(cfg, "k1")).resolves.toBeUndefined()
    await expect(discardUpload(cfg, "k1")).rejects.toThrow()
  })

  it("the card texts exist in every language", () => {
    for (const language of ["en", "ru", "es"] as const) {
      setActiveLanguage(language)
      expect(uploadErrorText({ code: "ownDuplicate" })).not.toMatch(/^ugc\./)
    }
    setActiveLanguage("en")
    expect(uploadErrorText({ code: "ownDuplicate" })).toBe("You already added a recording with this title that sounds the same.")
  })
})

/* ------------------------------------------------------------------ level 3: mantras */

describe("level 3: the mantra key", () => {
  it("joins spellings of one mantra, like the server does", () => {
    const keys = ["Baba Nam Kevalam", "Bábá Nám Kevalam", "baba-nam-kevalam", "  BABA   NAM  KEVALAM! ", "Baba Nam Kevalam."].map(mantraKey)
    expect(new Set(keys)).toEqual(new Set(["babanamkevalam"]))
  })

  it("keeps the letters of other scripts and drops punctuation", () => {
    expect(mantraKey("Баба Нам Кевалам")).toBe("бабанамкевалам")
    expect(mantraKey("बाबा नाम केवलम्")).toBe("बाबानामकेवलम्")
    expect(mantraKey("Hare Krishna, Hare Rama (2)")).toBe("harekrishnaharerama2")
  })

  it("is empty for nothing and for punctuation only", () => {
    expect(mantraKey("")).toBe("")
    expect(mantraKey(null)).toBe("")
    expect(mantraKey(" - ! ")).toBe("")
  })

  it("cleans the shown title", () => {
    expect(cleanMantra("  Baba   Nam \n Kevalam ")).toBe("Baba Nam Kevalam")
  })

  it("counts versions in each language", () => {
    expect(versionsLabel(1)).toBe("1 version")
    expect(versionsLabel(12)).toBe("12 versions")
    expect(versionsOfThisLabel(12)).toBe("12 versions of this mantra")
    expect(versionWord(1)).toBe("version")
    setActiveLanguage("ru")
    expect(versionsLabel(1)).toBe("1 версия")
    expect(versionsLabel(3)).toBe("3 версии")
    expect(versionsLabel(5)).toBe("5 версий")
    expect(versionWord(5)).toBe("версий")
    setActiveLanguage("es")
    expect(versionsOfThisLabel(2)).toBe("2 versiones de este mantra")
  })
})

describe("level 3: mantras on the phone (demo preview)", () => {
  const list = KIRTAN_FIXTURES

  it("groups the sample recordings by mantra, most versions first", () => {
    const groups = groupLocalMantras(list, "kiirtan")
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ id: "m-bnk", title: "Baba Nam Kevalam", versions: 5 })
  })

  it("does not invent mantras for recordings that name none", () => {
    expect(groupLocalMantras(list.filter((k) => !k.mantra))).toEqual([])
  })

  it("suggests by any spelling, starting-with first", () => {
    const more = [...list, { ...list[0], id: "x", mantra: "Hari Nam Kiirtan", mantraId: "m-hari", title: "x", addedAt: 1 }]
    expect(suggestLocalMantras(more, "Bábá", "kiirtan").map((m) => m.title)).toEqual(["Baba Nam Kevalam"])
    expect(suggestLocalMantras(more, "nam", "kiirtan").map((m) => m.title)).toEqual(["Baba Nam Kevalam", "Hari Nam Kiirtan"])
    expect(suggestLocalMantras(more, "", "kiirtan")).toHaveLength(2)
    expect(suggestLocalMantras(more, "zzz", "kiirtan")).toEqual([])
  })

  it("counts the versions of a typed mantra, spelling-proof", () => {
    expect(lookupLocalMantra(list, "BÁBÁ-NÁM kevalam", "kiirtan").versions).toBe(5)
    expect(lookupLocalMantra(list, "Something new", "kiirtan")).toEqual({ mantra: null, versions: 0 })
    expect(lookupLocalMantra(list, "", "kiirtan")).toEqual({ mantra: null, versions: 0 })
    expect(lookupLocalMantra(list, "Baba Nam Kevalam", "bhajan").versions).toBe(0)
  })

  it("lists the versions newest or most played first, and leaves out those that are not live", () => {
    const newest = localVersions(list, "m-bnk", "newest").items
    const plays = localVersions(list, "m-bnk", "plays").items
    expect(newest.map((k) => k.addedAt)).toEqual([...newest.map((k) => k.addedAt)].sort((a, b) => b - a))
    expect((plays[0].plays ?? 0)).toBe(Math.max(...plays.map((k) => k.plays ?? 0)))
    expect(localVersions(list, "m-none", "newest")).toEqual({ mantra: null, items: [] })
    const withRemoved = [...list, { ...list[0], id: "gone", status: "removed" as const }]
    expect(localVersions(withRemoved, "m-bnk", "newest").items.some((k) => k.id === "gone")).toBe(false)
  })

  it("the mantra sources answer from the phone only in the demo preview; elsewhere they ask the server", async () => {
    // tests run like a release build: no samples, so the server is asked
    expect(sampleKirtans()).toEqual([])
    const { cfg, calls } = server((call) => {
      if (call.url.includes("/mantras/suggest")) return json(200, [{ id: "g1", kind: "kiirtan", title: "Baba Nam Kevalam", versions: 12, plays: 0 }])
      if (call.url.includes("/mantras/lookup")) return json(200, { title: "Baba Nam Kevalam", mantra: { id: "g1", kind: "kiirtan", title: "Baba Nam Kevalam", versions: 12, plays: 0 }, versions: 12 })
      if (call.url.includes("/mantras/g1")) return json(200, { mantra: { id: "g1", kind: "kiirtan", title: "Baba Nam Kevalam", versions: 1, plays: 3 }, items: [REC], total: 1 })
      return json(200, { items: [{ id: "g1", kind: "kiirtan", title: "Baba Nam Kevalam", versions: 12, plays: 0 }], total: 1 })
    })
    expect((await suggestMantraTitles("baba", "kiirtan", cfg))[0]).toMatchObject({ id: "g1", versions: 12 })
    expect(await versionsOfMantra("Bábá Nám Kevalam", "kiirtan", cfg)).toMatchObject({ versions: 12, mantra: { id: "g1" } })
    expect(await versionsOfMantra("   ", "kiirtan", cfg)).toEqual({ mantra: null, versions: 0 })
    expect((await loadMantras("kiirtan", cfg)).map((m) => m.title)).toEqual(["Baba Nam Kevalam"])
    const versions = await loadMantraVersions("g1", "plays", cfg)
    expect(versions.items.map((k) => k.serverId)).toEqual(["r1"])
    expect(calls.map((c) => c.url)).toContain("https://api.test/api/v1/recordings/mantras/g1?sort=plays&limit=100")
    // the versions were put in the catalogue, so the one player can queue them
    expect(allKirtans().some((k) => k.serverId === "r1")).toBe(true)
  })

  it("an unreachable server is an error for the screen to show, never an empty list", async () => {
    const { cfg } = server(() => {
      throw new Error("offline")
    })
    await expect(loadMantras("kiirtan", cfg)).rejects.toThrow()
  })

  it("leaves out versions of authors the person blocked", async () => {
    useKirtanStore.getState().blockAuthor("m1")
    const { cfg } = server(() => json(200, { mantra: { id: "g1", kind: "kiirtan", title: "T", versions: 1, plays: 0 }, items: [REC], total: 1 }))
    expect((await loadMantraVersions("g1", "newest", cfg)).items).toEqual([])
  })
})

describe("level 3: the mantra calls", () => {
  it("send the typed text, the kind and the sort to the public endpoints", async () => {
    const { cfg, calls } = server(() => json(200, { items: [], total: 0 }))
    await fetchMantras(cfg, { kind: "kiirtan", q: "baba" })
    await fetchMantraVersions(cfg, "g1", "newest").catch(() => undefined)
    const suggest = server(() => json(200, []))
    await suggestMantras(suggest.cfg, "bá ba", "bhajan", 4)
    const lookup = server(() => json(200, { title: "x", mantra: null, versions: 0 }))
    await lookupMantra(lookup.cfg, "Baba Nam", "kiirtan")
    expect(calls[0].url).toBe("https://api.test/api/v1/recordings/mantras?kind=kiirtan&q=baba&limit=100")
    expect(suggest.calls[0].url).toBe("https://api.test/api/v1/recordings/mantras/suggest?q=b%C3%A1+ba&kind=bhajan&limit=4")
    expect(lookup.calls[0].url).toBe("https://api.test/api/v1/recordings/mantras/lookup?title=Baba+Nam&kind=kiirtan")
  })

  it("publish sends the mantra and year only when there are some", async () => {
    const withMantra = server(() => json(200, REC))
    await publishRecording(withMantra.cfg, { key: "k", kind: "kiirtan", type: "other", title: "T", author: "A", byAuthor: true, termsVersion: "v", confirmDifferent: false, mantra: "  Baba Nam Kevalam ", year: 1999 })
    expect(withMantra.calls[0].body).toMatchObject({ mantra: "Baba Nam Kevalam", year: 1999 })
    const without = server(() => json(200, REC))
    await publishRecording(without.cfg, { key: "k", kind: "kiirtan", type: "other", title: "T", author: "A", byAuthor: true, termsVersion: "v", confirmDifferent: false, mantra: "   " })
    expect(without.calls[0].body).not.toHaveProperty("mantra")
    expect(without.calls[0].body).not.toHaveProperty("year")
  })

  it("a recording from the server keeps its mantra, its group and the one it was removed as a copy of", () => {
    const live = fromRemote({ ...REC, mantra: "Baba Nam Kevalam", mantra_id: "g1", year: 1999 })
    expect(live).toMatchObject({ mantra: "Baba Nam Kevalam", mantraId: "g1", year: 1999 })
    const removed = fromRemote({ ...REC, status: "removed", removed_reason: "A copy", removed_duplicate_of: "r0" })
    expect(removed).toMatchObject({ status: "removed", duplicateOf: { id: "r0" } })
    expect(fromRemote(REC)).not.toHaveProperty("mantra")
  })

  it("a new submission remembers the mantra as typed, tidied", () => {
    const k = buildSubmission({ kind: "kiirtan", fileName: "a.mp3", fileUri: "u", title: "T", author: "A", mantra: "  Baba   Nam Kevalam ", byAuthor: true, addedBy: "You" }, 1)
    expect(k.mantra).toBe("Baba Nam Kevalam")
    const none = buildSubmission({ kind: "kiirtan", fileName: "a.mp3", fileUri: "u", title: "T", author: "A", byAuthor: true, addedBy: "You" }, 1)
    expect(none).not.toHaveProperty("mantra")
  })
})

/* ------------------------------------------------------------------ level 4: report, removal, limit */

describe("level 4: Duplicate as a report reason, the removal, the daily limit", () => {
  it("is a report reason with words in every language", () => {
    expect(REPORT_REASONS).toContain("duplicate")
    expect(reportReasonLabel("duplicate")).toBe("Duplicate")
    expect(reportReasonHint("duplicate")).toBe("The same recording is already in the library")
    setActiveLanguage("ru")
    expect(reportReasonLabel("duplicate")).toBe("Дубликат")
    setActiveLanguage("es")
    expect(reportReasonLabel("duplicate")).toBe("Duplicado")
  })

  it("reads the daily limit from the X-Error-Code header and shows a friendly sentence", async () => {
    const { cfg } = server(() => json(429, { detail: "You can add up to 20 recordings a day." }, { "X-Error-Code": "upload_daily_limit" }))
    const out = await uploadSubmission(cfg, source, deps)
    expect(out).toMatchObject({ status: "failed", failure: { code: "dailyLimit" } })
    if (out.status !== "failed") throw new Error("expected a failure")
    expect(uploadErrorText(out.failure)).toBe("You have added a lot of recordings today. Please come back tomorrow to add more. Thank you for sharing.")
  })

  it("other 429s (too many requests in an hour) are not the daily limit", async () => {
    const { cfg } = server(() => json(429, { detail: "Too many requests" }))
    const out = await uploadSubmission(cfg, source, deps)
    expect(out).toMatchObject({ status: "failed", failure: { code: "server", message: "Too many requests" } })
  })

  it("the same author's own copy is named, with the recording that is theirs", () => {
    const error = new RemoteError(409, "x", { code: "own_duplicate", duplicateOf: BRIEF })
    expect(failureFromError(error)).toMatchObject({ code: "ownDuplicate", original: { id: "r0" } })
  })

  it("a recording removed as a copy shows its reason and where the original is", () => {
    useKirtanStore.getState().applyMine([{ ...REC, status: "removed", removed_reason: "Same as Old one.", removed_duplicate_of: "r0", removed_at: "2026-11-02T00:00:00Z" }])
    const mine = useKirtanStore.getState().submissions
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ status: "removed", removedReason: "Same as Old one.", duplicateOf: { id: "r0" } })
  })
})

/* ------------------------------------------------------------------ playing the recording that is there */

describe("listening to the recording that is already there", () => {
  const ref = { id: "r0", title: "Old one", author: "B", audioUrl: "https://cdn/r0.mp3", kind: "kiirtan" as const }

  it("adds it to the catalogue once, so the one player can queue it", () => {
    const first = playableOriginal(ref)
    expect(first).toMatchObject({ serverId: "r0", title: "Old one", status: "published", audioUrl: "https://cdn/r0.mp3" })
    expect(playableOriginal(ref)?.id).toBe(first?.id)
    expect(useKirtanStore.getState().catalog).toHaveLength(1)
  })

  it("has nothing to play without an audio link", () => {
    expect(playableOriginal({ ...ref, audioUrl: "" })).toBeNull()
    expect(useKirtanStore.getState().catalog).toHaveLength(0)
  })

  it("does not double the catalogue", () => {
    useKirtanStore.getState().addToCatalog([REC])
    useKirtanStore.getState().addToCatalog([REC, { ...REC, id: "r2" }])
    expect(useKirtanStore.getState().catalog.map((k) => k.serverId)).toEqual(["r1", "r2"])
  })
})
