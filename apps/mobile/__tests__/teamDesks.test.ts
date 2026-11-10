import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { NetworkError, RemoteError } from "@/lib/kirtan/remote"
import { deskDetail, deskFailure, teamDesksRemote } from "@/lib/teamDesks/remote"
import {
  FLAG_TABS,
  TAB_STATUSES,
  TAKEDOWN_TABS,
  WORD_FILTERS,
  baselineLabel,
  countsByField,
  filterTargets,
  flagActions,
  flagKey,
  leftOut,
  localDay,
  needsReason,
  reasonProblem,
  recordingPath,
  suggestedTarget,
  takedownActions,
  targetLabel,
  waitIsOver,
  wordsOf,
} from "@/lib/teamDesks/rules"
import type { FlagItem, WordItem } from "@/lib/teamDesks/types"
import { dictionaries } from "@/locales"
import review from "@/locales/review.json"

/** The team's desks (docs/team-desks.md): the rules the buttons follow, the calls to the API, and what the screens must keep doing. */
const ROOT = join(__dirname, "..")
const read = (path: string) => readFileSync(join(ROOT, path), "utf8")

const word = (over: Partial<WordItem> = {}): WordItem => ({
  id: "w1",
  field: "instrument",
  label: "Theremin",
  key: "theremin",
  status: "pending",
  similar_to: null,
  recordings_count: 2,
  people_count: 1,
  created_at: null,
  first_by: "Ananda",
  merge_targets: [
    { code: "harmonium", label: "Harmonium" },
    { code: "bass_guitar", label: "Bass guitar" },
  ],
  ...over,
})

describe("the words queue rules", () => {
  it("filters by kind and counts each kind", () => {
    const items = [word(), word({ id: "w2", field: "style" }), word({ id: "w3", field: "style" })]
    expect(wordsOf(items, "all")).toHaveLength(3)
    expect(wordsOf(items, "style").map((w) => w.id)).toEqual(["w2", "w3"])
    expect(countsByField(items)).toEqual({ all: 3, instrument: 1, style: 2, mood: 0, language: 0, mantra: 0 })
    expect(WORD_FILTERS[0]).toBe("all")
  })

  it("starts the merge picker on the listed value the word looks like, only when the list carries it", () => {
    expect(suggestedTarget(word({ similar_to: "harmonium" }))).toBe("harmonium")
    expect(suggestedTarget(word({ similar_to: "tabla" }))).toBeNull()
    expect(suggestedTarget(word())).toBeNull()
    expect(targetLabel(word(), "bass_guitar")).toBe("Bass guitar")
    expect(targetLabel(word(), "tabla")).toBe("tabla")
    expect(targetLabel(word(), null)).toBeNull()
  })

  it("searches the picker by name or code, ignoring case and accents", () => {
    const targets = [{ code: "bass_guitar", label: "Bass guitar" }, { code: "es", label: "Español" }]
    expect(filterTargets(targets, "")).toHaveLength(2)
    expect(filterTargets(targets, "BASS").map((t) => t.code)).toEqual(["bass_guitar"])
    expect(filterTargets(targets, "espanol").map((t) => t.code)).toEqual(["es"])
    expect(filterTargets(targets, "zzz")).toEqual([])
  })
})

describe("the takedown desk rules", () => {
  const base = { kind: "notice" as const, status: "new" as const, recording_id: "r1", waiting_until: null }

  it("takes a new notice down or turns it down, and asks for the link first when none is found", () => {
    expect(takedownActions(base)).toEqual(["takeDown", "reject"])
    expect(takedownActions({ ...base, recording_id: null })).toEqual(["link", "reject"])
  })

  it("lets a turned-down notice still be taken down, and a taken-down one be closed", () => {
    expect(takedownActions({ ...base, status: "rejected" })).toEqual(["takeDown"])
    expect(takedownActions({ ...base, status: "taken_down" })).toEqual(["close"])
    expect(takedownActions({ ...base, status: "counter_received" })).toEqual(["close"])
    for (const status of ["restored", "closed"] as const) expect(takedownActions({ ...base, status })).toEqual([])
  })

  it("passes a counter-notice on, then restores it after the waiting time or when the claimant withdrew", () => {
    const counter = { ...base, kind: "counter_notice" as const }
    expect(takedownActions(counter)).toEqual(["forward", "close"])
    const now = new Date("2026-11-10T12:00:00Z")
    expect(takedownActions({ ...counter, status: "forwarded", waiting_until: "2026-11-20T00:00:00Z" }, now)).toEqual(["restoreWithdrawn", "close"])
    expect(takedownActions({ ...counter, status: "forwarded", waiting_until: "2026-11-01T00:00:00Z" }, now)).toEqual(["restore", "close"])
    expect(takedownActions({ ...counter, status: "restored" })).toEqual([])
  })

  it("reads the waiting time: none, past, future, garbage", () => {
    const now = new Date("2026-11-10T12:00:00Z")
    expect(waitIsOver(null, now)).toBe(true)
    expect(waitIsOver("2026-11-09T00:00:00Z", now)).toBe(true)
    expect(waitIsOver("2026-11-11T00:00:00Z", now)).toBe(false)
    expect(waitIsOver("not a date", now)).toBe(true)
  })

  it("asks for a written reason on reject and close only, at least 3 characters", () => {
    expect(needsReason("reject")).toBe(true)
    expect(needsReason("close")).toBe(true)
    expect(needsReason("takeDown")).toBe(false)
    expect(reasonProblem("  ab ")).toBe("short")
    expect(reasonProblem("abc")).toBeNull()
  })

  it("asks the server for each tab's statuses, covering every status once", () => {
    const all = TAKEDOWN_TABS.flatMap((tab) => TAB_STATUSES[tab].split(","))
    expect([...all].sort()).toEqual(["closed", "counter_received", "forwarded", "new", "rejected", "restored", "taken_down"])
  })

  it("links to a recording page only when there is an id, and encodes it", () => {
    expect(recordingPath(null)).toBeNull()
    expect(recordingPath("a/b c")).toBe("/recording/a%2Fb%20c")
  })
})

describe("the play checks rules", () => {
  const flag = (over: Partial<FlagItem> = {}): FlagItem => ({
    recording_id: "r1",
    recording_title: "Baba Nam Kevalam",
    day: "2026-11-09",
    plays: 500,
    held: 480,
    confirmed_held: 0,
    last_decision: null,
    baseline: 10,
    reason: "far above the usual",
    status: "open",
    created_at: "2026-11-10T00:00:00Z",
    reviewed_by: null,
    reviewed_at: null,
    ...over,
  })

  it("offers real/inflated on an open day, and take-back where something is confirmed", () => {
    expect(flagActions(flag())).toEqual(["clear", "confirm"])
    expect(flagActions(flag({ status: "open", confirmed_held: 40 }))).toEqual(["clear", "confirm", "unconfirm"])
    expect(flagActions(flag({ status: "cleared" }))).toEqual(["confirm"])
    expect(flagActions(flag({ status: "cleared", confirmed_held: 40 }))).toEqual(["confirm", "unconfirm"])
    expect(flagActions(flag({ status: "confirmed", confirmed_held: 480 }))).toEqual(["unconfirm"])
  })

  it("counts what is left out of the numbers as the server does: confirmed part, plus the suspected part while open", () => {
    expect(leftOut(flag())).toBe(480)
    expect(leftOut(flag({ status: "cleared", held: 480 }))).toBe(0)
    expect(leftOut(flag({ status: "cleared", held: 0, confirmed_held: 30 }))).toBe(30)
    expect(leftOut(flag({ status: "open", held: 10, confirmed_held: 30 }))).toBe(40)
  })

  it("names the three tabs, one key per recording and day, a baseline with one decimal at most", () => {
    expect(FLAG_TABS).toEqual(["open", "cleared", "confirmed"])
    expect(flagKey(flag())).toBe("r1:2026-11-09")
    expect(baselineLabel(10)).toBe("10")
    expect(baselineLabel(12.456)).toBe("12.5")
    expect(baselineLabel(Number.NaN)).toBe("0")
  })

  it("reads a calendar day as a local date, so no time zone moves it", () => {
    const day = localDay("2026-11-09")!
    expect([day.getFullYear(), day.getMonth() + 1, day.getDate()]).toEqual([2026, 11, 9])
    expect(localDay("soon")).toBeNull()
  })
})

type Call = { url: string; method: string; body: unknown }
function server(answer: (call: Call) => { status?: number; body?: unknown }) {
  const calls: Call[] = []
  const fake = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = { url: String(input), method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body as string) : undefined }
    calls.push(call)
    const { status = 200, body = {} } = answer(call)
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
  }) as typeof fetch
  return { calls, desks: teamDesksRemote({ baseUrl: "https://api.example/", headers: () => ({ "X-Member": "m" }), fetch: fake }) }
}

describe("the desks' calls to the API", () => {
  it("lists pending words and decides one, sending the listed value only on a merge", async () => {
    const s = server((c) => (c.method === "GET" ? { body: { items: [{ id: "w1" }], total: 1 } } : { body: { id: "w1", status: "merged" } }))
    expect(await s.desks.words.list(null)).toEqual([{ id: "w1" }])
    expect(s.calls[0]!.url).toBe("https://api.example/api/v1/recordings/value-suggestions?status=pending")
    await s.desks.words.decide("w 1", "merge", { mergeInto: "harmonium" })
    await s.desks.words.decide("w1", "reject")
    expect(s.calls[1]).toMatchObject({ url: "https://api.example/api/v1/recordings/value-suggestions/w%201/decision", method: "POST", body: { action: "merge", merge_into: "harmonium" } })
    expect(s.calls[2]!.body).toEqual({ action: "reject" })
  })

  it("asks the takedown queue by status list and sends each action to its own address", async () => {
    const s = server(() => ({ body: { items: [], total: 0 } }))
    await s.desks.takedowns.list("taken_down,counter_received", 20, 40)
    expect(s.calls[0]!.url).toBe("https://api.example/api/v1/team/takedowns?status=taken_down%2Ccounter_received&limit=20&offset=40")
    await s.desks.takedowns.takeDown("t1", "  checked  ")
    await s.desks.takedowns.takeDown("t1")
    await s.desks.takedowns.reject("t1", " not our work ")
    await s.desks.takedowns.forward("t2")
    await s.desks.takedowns.restore("t2", true)
    await s.desks.takedowns.close("t2", "legal process")
    await s.desks.takedowns.link("t1", "https://x/recording/abc")
    const seen = s.calls.slice(1).map((c) => [c.method, c.url.replace("https://api.example/api/v1/team/takedowns/", ""), c.body])
    expect(seen).toEqual([
      ["POST", "t1/take-down", { note: "checked" }],
      ["POST", "t1/take-down", {}],
      ["POST", "t1/reject", { reason: "not our work" }],
      ["POST", "t2/forward", undefined],
      ["POST", "t2/restore", { claimant_withdrew: true }],
      ["POST", "t2/close", { reason: "legal process" }],
      ["POST", "t1/link", { recording: "https://x/recording/abc" }],
    ])
  })

  it("lists play flags by status and decides a day by recording and date", async () => {
    const s = server(() => ({ body: [] }))
    await s.desks.flags.list("confirmed")
    await s.desks.flags.decide({ recording_id: "r1", day: "2026-11-09" }, "unconfirm")
    expect(s.calls[0]!.url).toBe("https://api.example/api/v1/team/play-flags?status=confirmed&limit=200")
    expect(s.calls[1]).toMatchObject({ method: "POST", url: "https://api.example/api/v1/team/play-flags/r1/2026-11-09/unconfirm" })
  })

  it("sends the member headers", async () => {
    let headers: unknown
    const fake = (async (_u: RequestInfo | URL, init?: RequestInit) => {
      headers = init?.headers
      return new Response("[]", { status: 200 })
    }) as typeof fetch
    await teamDesksRemote({ baseUrl: "https://api.example", headers: () => ({ "X-Member": "m" }), fetch: fake }).flags.list("open")
    expect(headers).toMatchObject({ "X-Member": "m" })
  })

  it("sorts a failure: refused, offline, already decided or gone, refused with a reason, other", async () => {
    expect(deskFailure(new RemoteError(403, "x"))).toBe("denied")
    expect(deskFailure(new RemoteError(401, "x"))).toBe("denied")
    expect(deskFailure(new NetworkError())).toBe("network")
    expect(deskFailure(new RemoteError(409, "x"))).toBe("conflict")
    expect(deskFailure(new RemoteError(404, "x"))).toBe("gone")
    expect(deskFailure(new RemoteError(422, "x"))).toBe("invalid")
    expect(deskFailure(new RemoteError(500, "x"))).toBe("server")
    expect(deskFailure(new Error("x"))).toBe("server")
    expect(deskDetail(new RemoteError(409, "The waiting time ends 2026-11-20."))).toBe("The waiting time ends 2026-11-20.")
    expect(deskDetail(new RemoteError(409, "Request failed (409)"))).toBeNull()
    expect(deskDetail(new RemoteError(500, "boom"))).toBeNull()
  })
})

describe("the three screens", () => {
  const SCREENS = ["app/team-words.tsx", "app/team-takedowns.tsx", "app/team-play-flags.tsx"]
  const PARTS = ["components/team-desks/DeskFrame.tsx", "hooks/useDeskLoad.ts"]

  it("show loading, empty and error states through the shared status line", () => {
    for (const file of SCREENS) {
      const source = read(file)
      expect(source, file).toContain("<DeskStatus")
      expect(source, file).toMatch(/status === "ready" && .*\.length === 0/)
      expect(source, file).toContain("useDeskLoad(")
    }
    const frame = read("components/team-desks/DeskFrame.tsx")
    for (const key of ["teamDesk.loading", "teamDesk.error", "teamDesk.offline", "teamDesk.denied", "teamDesk.retry"]) expect(frame).toContain(key)
  })

  it("move nothing by themselves: only the app's pressables animate, and those follow reduced motion", () => {
    for (const file of [...SCREENS, ...PARTS]) {
      expect(read(file), file).not.toMatch(/Animated\b|withSpring|withTiming|LayoutAnimation|transition:|animation/)
    }
    expect(read("components/kirtan/KPress.tsx")).toContain("useReducedMotion")
  })

  it("use the app's v2 look: the songs theme, the shared buttons and chips, no inline style objects", () => {
    for (const file of SCREENS) {
      const source = read(file)
      expect(source, file).toContain("useSongsTheme")
      expect(source, file).toContain("@/components/song-chords/parts")
      expect(source, file).not.toMatch(/style=\{\{\s*(?!\.\.\.)/)
    }
  })

  it("never hide or restore anything on mount: decisions are taps", () => {
    for (const file of SCREENS) {
      const source = read(file)
      const effects = source.match(/useEffect\(/g) ?? []
      expect(effects, file).toHaveLength(0)
    }
    // the only place a takedown starts is a button; the take-down button asks once more
    expect(read("app/team-takedowns.tsx")).toContain('setStep(action)')
  })

  it("are linked from the Upload hub for the team only, and are in the mini-player policy", () => {
    const upload = read("app/upload.tsx")
    for (const route of ["/team-words", "/team-takedowns", "/team-play-flags"]) {
      const at = upload.indexOf(`href("${route}")`)
      expect(at, route).toBeGreaterThan(-1)
      // the row sits right under `{team ? (` and closes with `) : null}`: a member who is not on the team never gets it
      expect(upload.slice(Math.max(0, at - 260), at), route).toContain("{team ? (")
      expect(upload.slice(at, at + 160), route).toContain(") : null}")
    }
    const policy = read("lib/playerPolicy.ts")
    expect(policy).toContain('"/team-words", "/team-takedowns", "/team-play-flags"')
  })

  it("have words in English, Russian and Spanish, with Russian and Spanish marked unreviewed", () => {
    const keys = Object.keys(dictionaries.en).filter((k) => k.startsWith("teamDesk."))
    expect(keys.length).toBeGreaterThan(100)
    const marks = review as unknown as Record<string, Record<string, boolean>>
    for (const language of ["ru", "es"] as const) {
      for (const key of keys) {
        expect((dictionaries[language] as Record<string, string>)[key], `${language}:${key}`).toBeTruthy()
        expect(marks[language]![key], `${language}:${key} review mark`).toBe(false)
      }
    }
  })

  it("name Kiirtan with two i's in no English string that mentions it", () => {
    for (const [key, text] of Object.entries(dictionaries.en)) {
      if (key.startsWith("teamDesk.")) expect(text, key).not.toMatch(/\bKirtan\b/)
    }
  })
})
