import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/i18n", () => ({ t: (key: string) => key }))

import { aggregateRecordings } from "@/lib/searchMenu/aggregate"
import { MENU_RULES, MENU_TITLE_KEYS } from "@/lib/searchMenu/config"
import { buildMenu, isColdStart } from "@/lib/searchMenu/rules"
import type { MenuRecording, MenuStats } from "@/lib/searchMenu/types"
import { en } from "@/locales/en"
import { es } from "@/locales/es"
import { ru } from "@/locales/ru"

/** The adaptive browse menu (docs/search-menu.md): thresholds, hysteresis, honesty, caps, pins, cold start. */

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 7)

const PS = [
  { kind: "mood", count: 6 },
  { kind: "festival", count: 8 },
  { kind: "theme", count: 32 },
]

function stats(over: Partial<MenuStats> = {}): MenuStats {
  return {
    now: NOW,
    psCollections: PS,
    psRecordings: 0,
    kiirtanTypes: {},
    kiirtanSets: 0,
    bhajanLanguages: {},
    bhajanTypes: {},
    spiritualSongs: 0,
    authors: [],
    newInWindow: 0,
    played: { source: "none", recordingsWithPlays: 0, totalPlays: 0 },
    themes: [],
    ...over,
  }
}
const ids = (s: MenuStats) => buildMenu(s).shelves.map((x) => x.id)
const author = (key: string, recordings: number, extra: object = {}) => ({ key, name: key, recordings, ...extra })

describe("cold start", () => {
  it("shows only the collections the app already holds", () => {
    const r = buildMenu(stats())
    expect(r.shelves.map((s) => s.id)).toEqual(["ps:kind:mood", "ps:kind:festival", "ps:kind:theme"])
    expect(isColdStart(r)).toBe(true)
    expect(r.hidden.find((h) => h.id === "mostPlayed")?.why).toBe("no-data")
  })
  it("never emits a shelf with nothing in it", () => {
    const r = buildMenu(stats({ kiirtanTypes: { bnk: 0 }, bhajanLanguages: { ru: 0 }, themes: [{ id: "joyful", confirmed: 0 }], spiritualSongs: 0 }))
    expect(r.shelves.every((s) => s.count > 0)).toBe(true)
  })
  it("is deterministic", () => {
    const s = stats({ kiirtanTypes: { bnk: 9, lila: 4 }, newInWindow: 5 })
    expect(buildMenu(s)).toEqual(buildMenu(s))
  })
})

describe("New this month", () => {
  it("appears at the threshold, not under it", () => {
    expect(ids(stats({ newInWindow: MENU_RULES.newMonth.on - 1 }))).not.toContain("new")
    expect(ids(stats({ newInWindow: MENU_RULES.newMonth.on }))).toContain("new")
  })
  it("does not blink at the edge: a visible shelf survives one recording fewer", () => {
    const first = buildMenu(stats({ newInWindow: 3 }))
    const edge = buildMenu(stats({ newInWindow: 2, memory: first.memory, now: NOW + DAY }))
    expect(edge.shelves.find((s) => s.id === "new")?.reason).toBe("kept")
  })
  it("leaves below the off threshold once the hold has run out, and at once when empty", () => {
    const first = buildMenu(stats({ newInWindow: 3 }))
    const late = NOW + (MENU_RULES.holdDays + 1) * DAY
    expect(ids(stats({ newInWindow: 1, memory: first.memory, now: NOW + DAY }))).toContain("new")
    expect(ids(stats({ newInWindow: 1, memory: first.memory, now: late }))).not.toContain("new")
    expect(ids(stats({ newInWindow: 0, memory: first.memory, now: NOW + DAY }))).not.toContain("new")
  })
})

describe("Most played", () => {
  it("stays away without play counts, and with too few", () => {
    expect(ids(stats())).not.toContain("mostPlayed")
    const few = stats({ played: { source: "lifetime", recordingsWithPlays: 4, totalPlays: 900 } })
    expect(ids(few)).not.toContain("mostPlayed")
    const low = stats({ played: { source: "lifetime", recordingsWithPlays: 9, totalPlays: 20 } })
    expect(ids(low)).not.toContain("mostPlayed")
  })
  it("appears with real counts and says which window they are from", () => {
    const r = buildMenu(stats({ played: { source: "window", recordingsWithPlays: 12, totalPlays: 300 } }))
    const shelf = r.shelves.find((s) => s.id === "mostPlayed")
    expect(shelf?.source).toBe("window")
    expect(shelf?.block).toBe("pulse")
  })
})

describe("authors", () => {
  it("cold start: authors by recording count, at most three, the block is not called popular", () => {
    const r = buildMenu(stats({ authors: [author("a", 9), author("b", 8), author("c", 7), author("d", 6), author("e", 2)] }))
    const got = r.shelves.filter((s) => s.block === "authors")
    expect(got.map((s) => s.id)).toEqual(["author:a", "author:b", "author:c"])
    expect(got.every((s) => s.reason === "catalogue")).toBe(true)
    expect(r.authorsTitleKey).toBe("searchMenu.authors.catalogue")
  })
  it("with real listener counts only authors people really listen to get a shelf, and no padding", () => {
    const r = buildMenu(stats({ authors: [author("a", 9, { listeners30: 40 }), author("b", 8, { listeners30: 4 }), author("c", 7, { listeners30: 0 }), author("d", 2, { listeners30: 90 })] }))
    expect(r.shelves.filter((s) => s.block === "authors").map((s) => s.id)).toEqual(["author:a"])
    expect(r.authorsTitleKey).toBe("searchMenu.authors.popular")
  })
  it("an author the listener plays a lot gets a shelf and leads; the rule needs plays and variety", () => {
    const base = [author("a", 9, { listeners30: 40 }), author("mine", 3, { listeners30: 1 }), author("loop", 3, { listeners30: 1 }), author("solo", 1, { listeners30: 0 })]
    const listener = { authors: { mine: { plays: 6, distinct: 3 }, loop: { plays: 30, distinct: 1 }, solo: { plays: 20, distinct: 5 } } }
    const r = buildMenu(stats({ authors: base, listener }))
    expect(r.shelves.filter((s) => s.block === "authors").map((s) => [s.id, s.reason])).toEqual([
      ["author:mine", "personal"],
      ["author:a", "popular"],
    ])
  })
  it("at most two personal shelves and four author shelves", () => {
    const authors = Array.from({ length: 8 }, (_, i) => author(`p${i}`, 4, { listeners30: 20 + i }))
    const listener = { authors: Object.fromEntries(authors.slice(0, 5).map((a) => [a.key, { plays: 8, distinct: 4 }])) }
    const got = buildMenu(stats({ authors, listener })).shelves.filter((s) => s.block === "authors")
    expect(got.length).toBe(MENU_RULES.authors.max)
    expect(got.filter((s) => s.reason === "personal").length).toBe(MENU_RULES.authors.maxPersonal)
  })
  it("a personal shelf that just fell under the rule stays for the hold, then goes", () => {
    const listener = { authors: { mine: { plays: 6, distinct: 3 } } }
    const first = buildMenu(stats({ authors: [author("mine", 3)], listener }))
    const gone = { authors: { mine: { plays: 2, distinct: 1 } } }
    expect(ids(stats({ authors: [author("mine", 3)], listener: gone, memory: first.memory, now: NOW + 2 * DAY }))).toContain("author:mine")
    expect(ids(stats({ authors: [author("mine", 3)], listener: gone, memory: first.memory, now: NOW + 9 * DAY }))).not.toContain("author:mine")
  })
})

describe("kiirtan, spiritual, bhajans, themes", () => {
  it("kiirtan types and event sets need their own counts", () => {
    const got = ids(stats({ kiirtanTypes: { bnk: 12, lila: 2, festival: 3, other: 5 }, kiirtanSets: 1 }))
    expect(got).toContain("kiirtan:type:bnk")
    expect(got).toContain("kiirtan:type:festival")
    expect(got).not.toContain("kiirtan:type:lila")
    expect(got).not.toContain("kiirtan:sets")
    expect(got.indexOf("kiirtan:type:bnk")).toBeLessThan(got.indexOf("kiirtan:type:other"))
  })
  it("spiritual songs appear at three", () => {
    expect(ids(stats({ spiritualSongs: 2 }))).not.toContain("spiritual")
    expect(ids(stats({ spiritualSongs: 3 }))).toContain("spiritual")
  })
  it("bhajan languages: only languages that have recordings, the biggest five, the rest in one shelf", () => {
    const langs = { ru: 30, en: 22, hi: 15, bn: 9, es: 7, pt: 5, de: 4, it: 1, other: 3 }
    const got = buildMenu(stats({ bhajanLanguages: langs })).shelves.filter((s) => s.id.startsWith("bhajan:lang:"))
    expect(got.map((s) => s.id)).toEqual(["bhajan:lang:ru", "bhajan:lang:en", "bhajan:lang:hi", "bhajan:lang:bn", "bhajan:lang:es", "bhajan:lang:more"])
    expect(got.at(-1)?.count).toBe(5 + 4 + 1 + 3)
  })
  it("a language the listener plays a lot comes first", () => {
    const got = buildMenu(stats({ bhajanLanguages: { ru: 30, en: 22, hi: 15 }, listener: { languages: { hi: 7 } } }))
    expect(got.shelves.filter((s) => s.block === "bhajans")[0].id).toBe("bhajan:lang:hi")
  })
  it("themes need five confirmed recordings and at most six show", () => {
    const themes = [{ id: "joyful", confirmed: 5 }, { id: "longing", confirmed: 4 }, ...["a", "b", "c", "d", "e", "f"].map((id, i) => ({ id, confirmed: 6 + i }))]
    const got = buildMenu(stats({ themes })).shelves.filter((s) => s.block === "themes")
    expect(got.length).toBe(MENU_RULES.theme.max)
    expect(got.map((s) => s.id)).not.toContain("theme:longing")
  })
})

describe("order, pins, caps", () => {
  it("blocks come in a fixed order", () => {
    const blocks = buildMenu(stats({
      newInWindow: 5, kiirtanTypes: { bnk: 5 }, authors: [author("a", 6)], spiritualSongs: 3, bhajanLanguages: { ru: 4 }, themes: [{ id: "joyful", confirmed: 6 }],
    })).shelves.map((s) => s.block)
    const order = ["pulse", "ps", "kiirtan", "authors", "spiritual", "bhajans", "themes"]
    expect(blocks).toEqual([...blocks].sort((a, b) => order.indexOf(a) - order.indexOf(b)))
  })
  it("shelves that were visible keep their relative order when scores swap", () => {
    const first = buildMenu(stats({ kiirtanTypes: { bnk: 9, festival: 5 } }))
    expect(first.memory.order.indexOf("kiirtan:type:bnk")).toBeLessThan(first.memory.order.indexOf("kiirtan:type:festival"))
    const second = buildMenu(stats({ kiirtanTypes: { bnk: 5, festival: 9, lila: 20 }, memory: first.memory, now: NOW + DAY }))
    const k = second.shelves.filter((s) => s.block === "kiirtan").map((s) => s.id)
    expect(k).toEqual(["kiirtan:type:bnk", "kiirtan:type:festival", "kiirtan:type:lila"])
  })
  it("a pinned shelf skips the threshold but not the empty rule; only three pins count", () => {
    const s = stats({ spiritualSongs: 1, bhajanLanguages: { ru: 1 }, kiirtanTypes: { lila: 1, festival: 0 }, pins: ["spiritual", "kiirtan:type:festival", "bhajan:lang:ru", "kiirtan:type:lila"] })
    const got = ids(s)
    expect(got).toContain("spiritual")
    expect(got).toContain("bhajan:lang:ru")
    expect(got).not.toContain("kiirtan:type:festival")
    expect(got).not.toContain("kiirtan:type:lila")
  })
  it("a pinned author leads the authors block", () => {
    const r = buildMenu(stats({ authors: [author("a", 9, { listeners30: 40 }), author("pin", 1)], pins: ["author:pin"] }))
    expect(r.shelves.filter((s) => s.block === "authors")[0]).toMatchObject({ id: "author:pin", reason: "pinned" })
  })
  it("the whole menu never goes over the cap and keeps the collections and the pins", () => {
    const authors = Array.from({ length: 6 }, (_, i) => author(`x${i}`, 9, { listeners30: 30 }))
    const langs = Object.fromEntries(["ru", "en", "hi", "bn", "es", "pt", "de"].map((c) => [c, 9]))
    const themes = ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, confirmed: 9 }))
    const r = buildMenu(stats({
      newInWindow: 9, played: { source: "window", recordingsWithPlays: 20, totalPlays: 400 }, psRecordings: 5,
      kiirtanTypes: { bnk: 9, lila: 9, festival: 9, other: 9 }, kiirtanSets: 3, authors, spiritualSongs: 9,
      bhajanLanguages: langs, bhajanTypes: { morning: 5, evening: 5, devotional: 5 }, themes, pins: ["theme:f"],
    }))
    expect(r.shelves.length).toBeLessThanOrEqual(MENU_RULES.maxShelves)
    expect(r.shelves.filter((s) => s.id.startsWith("ps:kind:")).length).toBe(PS.length)
    expect(r.shelves.map((s) => s.id)).toContain("theme:f")
  })
})

describe("aggregateRecordings", () => {
  const rec = (over: Partial<MenuRecording>): MenuRecording => ({ kind: "kiirtan", type: "bnk", author: "Priya Devi", createdAt: NOW - DAY, ...over })
  const extra = { psCollections: PS }
  it("counts what is there and nothing else", () => {
    const s = aggregateRecordings([
      rec({}), rec({ createdAt: NOW - 40 * DAY, author: "priya  devi" }), rec({ type: "lila", author: "Arun & Priya Devi", collectionId: "s1" }),
      rec({ collectionId: "s1" }),
      rec({ kind: "bhajan", type: "morning", language: "ru", author: "Z" }),
      rec({ kind: "devotional_song", type: "other", language: "ru", author: "Z" }),
      rec({ kind: "bhajan", type: "other", language: null, author: "Z" }),
      rec({ kind: "spiritual_song", type: "other", language: "en", author: "Q" }),
      rec({ kind: "prabhat_samgiita", type: "other", author: "Q" }),
    ], NOW, extra)
    expect(s.kiirtanTypes).toEqual({ bnk: 3, lila: 1 })
    expect(s.bhajanLanguages).toEqual({ ru: 2 })
    expect(s.bhajanTypes).toEqual({ morning: 1, other: 2 })
    expect(s.spiritualSongs).toBe(1)
    expect(s.psRecordings).toBe(1)
    expect(s.kiirtanSets).toBe(1)
    expect(s.newInWindow).toBe(8)
    expect(s.authors.find((a) => a.key === "priya devi")?.recordings).toBe(4)
    expect(s.played.source).toBe("none")
  })
  it("play counts: lifetime only when the server sent them", () => {
    const s = aggregateRecordings([rec({ plays: 0 }), rec({ plays: 12 }), rec({ plays: 3 })], NOW, extra)
    expect(s.played).toEqual({ source: "lifetime", recordingsWithPlays: 2, totalPlays: 15 })
  })
  it("a recording from the future or older than the window is not new", () => {
    const s = aggregateRecordings([rec({ createdAt: NOW + DAY }), rec({ createdAt: NOW - 31 * DAY })], NOW, extra)
    expect(s.newInWindow).toBe(0)
  })
})

describe("visible words", () => {
  it("every title key exists in English, Russian and Spanish", () => {
    for (const key of MENU_TITLE_KEYS) {
      expect(en[key as keyof typeof en], `en ${key}`).toBeTruthy()
      expect((ru as Record<string, string>)[key], `ru ${key}`).toBeTruthy()
      expect((es as Record<string, string>)[key], `es ${key}`).toBeTruthy()
    }
  })
  it("every key the rules emit is on that list", () => {
    const r = buildMenu(stats({
      newInWindow: 5, played: { source: "lifetime", recordingsWithPlays: 9, totalPlays: 99 }, psRecordings: 4, kiirtanSets: 2, spiritualSongs: 3,
      authors: [author("a", 9, { listeners30: 30 })], bhajanLanguages: { ru: 3, other: 5 },
    }))
    const keys = r.shelves.flatMap((s) => (s.label.type === "key" ? [s.label.key] : []))
    keys.push(r.authorsTitleKey, "searchMenu.mostPlayed.window", "searchMenu.mostPlayed.lifetime")
    for (const key of keys) expect(MENU_TITLE_KEYS as readonly string[]).toContain(key)
  })
  it("Kiirtan is spelled with two i's", () => {
    for (const key of MENU_TITLE_KEYS) expect(String(en[key as keyof typeof en])).not.toMatch(/\bKirtan/)
  })
})
