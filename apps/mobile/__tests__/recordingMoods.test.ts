import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/i18n", () => ({ t: (key: string) => key }))
vi.mock("react-native", () => ({ Platform: { OS: "web" } }))
vi.mock("@react-native-async-storage/async-storage", () => ({ default: { getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined } }))

import { MOODS } from "@/lib/kirtan/moods"
import { withConfirmedMoods } from "@/lib/recordingMoods/flag"
import { createMoodMock, MoodMockFailure } from "@/lib/recordingMoods/mock"
import { moodFailureFromError, moodRemote, pageFromWire } from "@/lib/recordingMoods/remote"
import { decideMood, openMoods, orderedMoods, proposedMoods, waitingLine } from "@/lib/recordingMoods/rules"
import { NetworkError, RemoteError } from "@/lib/kirtan/remote"
import { en } from "@/locales/en"

/** The mood tags of a recording (docs/search-menu.md section 6): the rule's numbers, the phone's reading of the API, the preview's stand-in. */

describe("the numbers of the rule (the same as the server's)", () => {
  it("confirms at 3 yes when the uploader suggested, 5 when only listeners did, with 70 percent yes", () => {
    expect(decideMood("uploader", 3, 0)).toBe("confirmed")
    expect(decideMood("uploader", 2, 0)).toBe("suggested")
    expect(decideMood("uploader", 3, 2)).toBe("suggested")
    expect(decideMood("listeners", 4, 0)).toBe("suggested")
    expect(decideMood("listeners", 5, 2)).toBe("confirmed")
  })
  it("rejects under 30 percent yes after 5 votes, and not before", () => {
    expect(decideMood("uploader", 1, 4)).toBe("rejected")
    expect(decideMood("uploader", 0, 4)).toBe("suggested")
  })
})

describe("what the page shows", () => {
  const page = {
    moods: [
      { mood: "calm", status: "suggested" as const, source: "uploader" as const, locked: false, yes: 2, no: 0, mine: null },
      { mood: "devotion", status: "confirmed" as const, source: "uploader" as const, locked: false, yes: 4, no: 0, mine: "yes" as const },
    ],
  }
  it("always lists the six moods in the app's order, those nobody proposed as none", () => {
    const all = orderedMoods(page)
    expect(all.map((m) => m.mood)).toEqual([...MOODS])
    expect(all.find((m) => m.mood === "sad")?.status).toBe("none")
  })
  it("asks about the proposed moods and offers the rest as 'does another fit'", () => {
    expect(proposedMoods(page).map((m) => m.mood)).toEqual(["calm", "devotion"])
    expect(openMoods(page).map((m) => m.mood)).toEqual(["joyful", "longing", "ecstatic", "sad"])
  })
  it("says how far a waiting mood is: the number depends on who suggested it", () => {
    const needed = { uploader: 3, listeners: 5 }
    expect(waitingLine(page.moods[0], needed)).toEqual({ yes: 2, needed: 3 })
    expect(waitingLine({ ...page.moods[0], source: "listeners" }, needed)).toEqual({ yes: 2, needed: 5 })
  })
})

describe("confirmed moods join the recordings", () => {
  const rec = [{ id: "a" }, { id: "b", serverId: "srv-b" }, { id: "c", moods: ["calm"] as readonly string[] }]
  it("matches by the app's id or the server's and keeps what a recording already carried", () => {
    const out = withConfirmedMoods(rec, { a: ["joyful"], "srv-b": ["sad", "calm"], c: ["calm", "devotion"] })
    expect(out[0].moods).toEqual(["joyful"])
    expect(out[1].moods).toEqual(["sad", "calm"])
    expect(out[2].moods).toEqual(["calm", "devotion"])
  })
  it("returns the same list when nothing is confirmed, and the same object for an untouched recording", () => {
    expect(withConfirmedMoods(rec, {})).toBe(rec)
    const out = withConfirmedMoods(rec, { a: ["joyful"] })
    expect(out[1]).toBe(rec[1])
  })
})

describe("the phone's reading of the API", () => {
  it("turns the answer of a recording into the page", () => {
    const page = pageFromWire({
      recording_id: "r1",
      moods: [{ mood: "calm", status: "suggested", source: "uploader", locked: false, yes: 1, no: 0, mine: "yes" }, { mood: "sad", status: "none" }],
      can_vote: false,
      cannot_vote_because: "listen_first",
      can_suggest: false,
      needed: { uploader: 3, listeners: 5 },
    })
    expect(page.cannotVoteBecause).toBe("listen_first")
    expect(page.moods[1]).toMatchObject({ mood: "sad", yes: 0, no: 0, mine: null, locked: false })
  })

  it("sends the right calls", async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = []
    const fetch = vi.fn(async (url: string, init: { method: string; body?: string }) => {
      calls.push({ url, method: init.method, body: init.body })
      if (url.endsWith("/confirmed")) return new Response(JSON.stringify({ items: [{ recording_id: "r1", moods: ["calm"] }] }), { status: 200 })
      return new Response(null, { status: 204 })
    })
    const backend = moodRemote({ baseUrl: "http://api/", headers: () => ({}), fetch: fetch as never })
    expect(await backend.confirmed()).toEqual({ r1: ["calm"] })
    await backend.suggest("r1", ["calm", "joyful"])
    await backend.vote("r1", "calm", "yes")
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET http://api/api/v1/recording-moods/confirmed",
      "PUT http://api/api/v1/recording-moods/recordings/r1/suggest",
      "PUT http://api/api/v1/recording-moods/recordings/r1/votes/calm",
    ])
    expect(JSON.parse(calls[1].body as string)).toEqual({ moods: ["calm", "joyful"] })
    expect(JSON.parse(calls[2].body as string)).toEqual({ vote: "yes" })
  })

  it("names every failure the page has a sentence for, in all three languages", () => {
    const failures = ["network", "signin", "own_recording", "too_new", "listen_first", "vote_limit", "locked", "not_uploader", "too_many", "not_found", "failed"]
    expect(moodFailureFromError(new NetworkError())).toBe("network")
    expect(moodFailureFromError(new RemoteError(401, "x"))).toBe("signin")
    expect(moodFailureFromError(new RemoteError(429, "x"))).toBe("vote_limit")
    expect(moodFailureFromError(new RemoteError(403, "x", { code: "listen_first" }))).toBe("listen_first")
    expect(moodFailureFromError(new RemoteError(409, "x", { code: "locked" }))).toBe("locked")
    expect(moodFailureFromError(new RemoteError(500, "x"))).toBe("failed")
    for (const name of failures) expect(Object.keys(en), name).toContain(`recMoods.failure.${name === "too_many" ? "tooMany" : name}`)
    for (const reason of ["sign_in", "own", "too_new", "listen_first"]) expect(Object.keys(en), reason).toContain(`recMoods.cannot.${reason}`)
  })
})

describe("the preview's stand-in", () => {
  const make = (mine = false) => createMoodMock({ isMine: () => mine })

  it("starts with one confirmed and one waiting mood, so both states can be seen", async () => {
    const page = await make().recording("r1")
    const by = Object.fromEntries(page.moods.map((m) => [m.mood, m]))
    expect(by.devotion.status).toBe("confirmed")
    expect(by.joyful).toMatchObject({ status: "suggested", yes: 2 })
    expect(page.canVote).toBe(true)
    expect(page.canSuggest).toBe(false)
  })

  it("a listener's third yes confirms what the uploader suggested, a no takes the vote back down", async () => {
    const mock = make()
    await mock.vote("r1", "joyful", "yes")
    expect((await mock.recording("r1")).moods.find((m) => m.mood === "joyful")).toMatchObject({ yes: 3, mine: "yes", status: "confirmed" })
    await mock.vote("r1", "joyful", "no")
    expect((await mock.recording("r1")).moods.find((m) => m.mood === "joyful")).toMatchObject({ yes: 2, no: 1, mine: "no", status: "suggested" })
    await mock.vote("r1", "joyful", "clear")
    expect((await mock.recording("r1")).moods.find((m) => m.mood === "joyful")).toMatchObject({ yes: 2, no: 0, mine: null })
  })

  it("a yes for a mood nobody proposed starts it; a no cannot; the uploader suggests instead of voting", async () => {
    const mock = make()
    await mock.vote("r1", "sad", "yes")
    expect((await mock.recording("r1")).moods.find((m) => m.mood === "sad")).toMatchObject({ status: "suggested", source: "listeners", yes: 1 })
    await expect(mock.vote("r1", "longing", "no")).rejects.toBeInstanceOf(MoodMockFailure)
    const own = make(true)
    await expect(own.vote("r1", "joyful", "yes")).rejects.toMatchObject({ failure: "own_recording" })
    expect((await own.recording("r1")).canSuggest).toBe(true)
    expect((await own.recording("r1")).cannotVoteBecause).toBe("own")
    await own.suggest("r1", ["calm"])
    const moods = (await own.recording("r1")).moods
    expect(moods.find((m) => m.mood === "calm")?.status).toBe("suggested")
    expect(moods.find((m) => m.mood === "joyful")?.status).toBe("none") // the uploader changed their mind: an unconfirmed suggestion goes
    expect(moods.find((m) => m.mood === "devotion")?.status).toBe("confirmed")
    await expect(own.suggest("r1", ["calm", "sad", "joyful"])).rejects.toMatchObject({ failure: "too_many" })
    await expect(make().suggest("r1", ["calm"])).rejects.toMatchObject({ failure: "not_uploader" })
  })
})
