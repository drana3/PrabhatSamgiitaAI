import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/i18n", () => ({ t: (key: string) => key }))

import { entryFromTrack, trackKey } from "@/lib/listening/capture"
import { addEntry, groupHistory, HISTORY_CAP, makeEntry, removeEntry, sanitizeHistory, startOfDay } from "@/lib/listening/history"
import { listenerStatsFromHistory } from "@/lib/listening/stats"
import { PlayTracker } from "@/lib/authors/plays"
import { en } from "@/locales/en"
import { es } from "@/locales/es"
import { ru } from "@/locales/ru"

/** My listening history: local log, counted plays only, grouped Today / Yesterday / Earlier. */

const at = (d: number, h = 12, m = 0) => new Date(2026, 10, d, h, m).getTime()
const NOW = at(7, 15)

const rec = (id: string, over: Partial<Parameters<typeof makeEntry>[0]> = {}) =>
  makeEntry({ ref: "rec", itemId: id, title: `T ${id}`, kind: "kiirtan", author: "Priya Devi", at: NOW, ...over })

describe("history list", () => {
  it("puts a new entry on top and keeps one entry per track per day", () => {
    const first = rec("a", { at: at(7, 9) })
    const second = rec("b", { at: at(7, 10) })
    const again = rec("a", { at: at(7, 14) })
    const list = addEntry(addEntry(addEntry([], first), second), again)
    expect(list.map((e) => e.itemId)).toEqual(["a", "b"])
    expect(list[0].at).toBe(at(7, 14))
    // another day is another entry
    expect(addEntry(list, rec("a", { at: at(6, 10) })).length).toBe(3)
  })

  it("is capped, oldest first out", () => {
    let list = [] as ReturnType<typeof rec>[]
    for (let i = 0; i < HISTORY_CAP + 5; i += 1) list = addEntry(list, rec(`r${i}`, { at: NOW + i }))
    expect(list.length).toBe(HISTORY_CAP)
    expect(list[0].itemId).toBe(`r${HISTORY_CAP + 4}`)
  })

  it("removes exactly one entry", () => {
    const a = rec("a")
    const b = rec("b")
    expect(removeEntry([a, b], a.id)).toEqual([b])
    expect(removeEntry([a, b], "missing")).toEqual([a, b])
  })

  it("groups by local day: Today, Yesterday, Earlier, newest first, empty groups left out", () => {
    const list = [rec("old", { at: at(2, 18) }), rec("y", { at: at(6, 23, 59) }), rec("t1", { at: at(7, 0, 1) }), rec("t2", { at: at(7, 14) })]
    const groups = groupHistory(list, NOW)
    expect(groups.map((g) => g.key)).toEqual(["today", "yesterday", "earlier"])
    expect(groups[0].entries.map((e) => e.itemId)).toEqual(["t2", "t1"])
    expect(groupHistory([rec("old", { at: at(2) })], NOW).map((g) => g.key)).toEqual(["earlier"])
    expect(groupHistory([], NOW)).toEqual([])
    // just before local midnight is still yesterday
    expect(startOfDay(at(7, 0, 1))).toBe(at(7, 0, 0))
  })

  it("throws away anything in storage that is not an entry", () => {
    const good = rec("a")
    expect(sanitizeHistory([good, null, 5, { id: 1 }, { ...good, at: "x" }, { ...good, ref: "zz" }])).toEqual([good])
    expect(sanitizeHistory("nope")).toEqual([])
  })
})

describe("what counts as a play (same rule as the server count)", () => {
  const events: string[] = []
  const play = (tracker: PlayTracker, key: string, from: number, seconds: number, duration: number | null = 300) => {
    let clock = 1_000_000
    tracker.feed({ recordingId: key, playing: true, position: from, duration, at: clock })
    for (let s = 1; s <= seconds; s += 1) {
      clock += 1000
      tracker.feed({ recordingId: key, playing: true, position: from + s, duration, at: clock })
    }
  }

  it("a few seconds are not a play, 30 seconds are", () => {
    events.length = 0
    const tracker = new PlayTracker((e) => events.push(e.recording_id))
    play(tracker, "rec:short", 0, 12)
    expect(events).toEqual([])
    play(tracker, "rec:long", 0, 31)
    expect(events).toEqual(["rec:long"])
  })

  it("is counted once per track per day, and a Prabhat Samgiita song counts too", () => {
    events.length = 0
    const tracker = new PlayTracker((e) => events.push(e.recording_id))
    play(tracker, "ps:12", 0, 31)
    play(tracker, "ps:12", 0, 31)
    expect(events).toEqual(["ps:12"])
  })
})

describe("the entry made from the player's track", () => {
  const rectrack = { number: 1_000_000_001, title: "Baba Nam Kevalam", performer: "Priya Devi", kind: "kiirtan" as const, kiirtan: { id: "srv-9", type: "bnk", addedBy: "x", recording: "kiirtan" as const } }
  const pstrack = { number: 4015, title: "Bandhu Hata", performer: "", kind: undefined, kiirtan: undefined }

  it("names the track a recording or a song", () => {
    expect(trackKey(rectrack)).toBe("rec:srv-9")
    expect(trackKey(pstrack)).toBe("ps:4015")
    expect(trackKey(null)).toBeNull()
  })

  it("keeps what the catalogue knows about a recording (kind, language)", () => {
    const e = entryFromTrack(rectrack, NOW, { kind: "bhajan", language: "bn", author: "Priya Devi" })
    expect(e).toMatchObject({ ref: "rec", itemId: "srv-9", kind: "bhajan", language: "bn", author: "Priya Devi" })
    const ps = entryFromTrack(pstrack, NOW, null)
    expect(ps).toMatchObject({ ref: "ps", itemId: "4015", kind: "prabhat_samgiita" })
    expect(ps?.author).toBeUndefined()
  })
})

describe("what the local log tells the menu rules", () => {
  it("counts plays and distinct recordings per author in the last 60 days, a joint author for both", () => {
    const log = [
      rec("a", { at: NOW - 1000 }),
      rec("b", { at: NOW - 2000 }),
      rec("c", { at: at(6) }),
      rec("d", { at: at(5), author: "Arun & Priya Devi" }),
      rec("old", { at: NOW - 70 * 86_400_000 }),
      makeEntry({ ref: "ps", itemId: "5", title: "ps", kind: "prabhat_samgiita", at: NOW }),
      rec("h", { kind: "bhajan", language: "bn", author: "Zed", at: at(6) }),
    ]
    const stats = listenerStatsFromHistory(log, NOW)
    expect(stats.authors?.["priya devi"]).toEqual({ plays: 4, distinct: 4 })
    expect(stats.authors?.arun).toEqual({ plays: 1, distinct: 1 })
    expect(stats.languages).toEqual({ bn: 1 })
  })

  it("is empty for an empty log", () => {
    expect(listenerStatsFromHistory([], NOW)).toEqual({ authors: {}, languages: {} })
  })
})

describe("words", () => {
  const KEYS = [
    "history.title", "history.link", "history.local", "history.group.today", "history.group.yesterday", "history.group.earlier",
    "history.empty.title", "history.empty.body", "history.paused.title", "history.paused.body", "history.pause", "history.pause.hint",
    "history.remove.a11y", "history.clear", "history.clear.title", "history.clear.body", "history.clear.confirm", "history.again.a11y", "history.gone",
    "history.count_other", "today.baba.first", "today.baba.second", "today.baba.more",
  ]
  it("every key exists in en, ru and es", () => {
    for (const [name, dict] of [["en", en], ["ru", ru], ["es", es]] as const) {
      for (const key of KEYS) expect((dict as Record<string, string>)[key], `${name} ${key}`).toBeTruthy()
    }
  })
  it("Russian title is Dada's", () => {
    expect(ru["history.title" as keyof typeof ru]).toBe("Моя история прослушивания")
  })
})
