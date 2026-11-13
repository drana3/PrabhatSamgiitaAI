import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/i18n", () => ({ t: (key: string) => key }))

import { demoCatalog, stageHasBaba } from "@/lib/fixtures/searchMenuDemo"
import { KIRTAN_FIXTURES } from "@/lib/fixtures/kirtan"
import { aggregateRecordings } from "@/lib/searchMenu/aggregate"
import { MENU_RULES } from "@/lib/searchMenu/config"
import { discoverFacets, slugOf, titleCase } from "@/lib/searchMenu/facets"
import { labelFromId, shelfItems, shelfTitle, toMenuRecording, type MenuKirtan } from "@/lib/searchMenu/live"
import { buildMenu } from "@/lib/searchMenu/rules"
import type { MenuMemory, MenuRecording } from "@/lib/searchMenu/types"

/**
 * Category discovery (docs/search-menu.md section 10): the library is read, and the shelves and chips come from what it
 * holds. A category with nothing behind it is not on the menu; a new value reaches the menu by itself.
 */

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 7)
const PS = [{ kind: "mood", count: 6 }]

let n = 0
const rec = (over: Partial<MenuRecording> = {}): MenuRecording => ({ kind: "kiirtan", type: "bnk", author: `Author ${n++}`, createdAt: NOW - 60 * DAY, ...over })
const many = (count: number, over: Partial<MenuRecording> = {}) => Array.from({ length: count }, () => rec(over))

function menu(recordings: MenuRecording[], memory?: MenuMemory, now = NOW) {
  const stats = aggregateRecordings(recordings, now, { psCollections: PS, memory })
  return { stats, result: buildMenu(stats) }
}
const ids = (recordings: MenuRecording[], memory?: MenuMemory, now = NOW) => menu(recordings, memory, now).result.shelves.map((s) => s.id)

describe("discovery reads the library and decides nothing", () => {
  it("normalises a value: case, spacing and punctuation make no other value", () => {
    expect(slugOf("  Baul  Kiirtan! ")).toBe("baul-kiirtan")
    expect(slugOf("BAUL kiirtan")).toBe("baul-kiirtan")
    expect(slugOf("   ")).toBe("")
    expect(slugOf(null)).toBe("")
    expect(titleCase("baul-kiirtan")).toBe("Baul Kiirtan")
    expect(titleCase("slow")).toBe("Slow")
  })

  it("finds styles, custom styles, moods, dances and any tag, and ignores blanks", () => {
    const found = discoverFacets(
      [
        rec({ style: "folk", moods: ["joyful", "Joyful"], tags: { Tempo: ["Slow"], mood: ["calm"], empty: [], blank: ["  "] } }),
        rec({ style: "other", styleOther: "Baul" }),
        rec({ style: "other", styleOther: "  baul " }),
        rec({ style: "other" }),
        rec({ kind: "bhajan", style: "folk" }),
        rec({ kind: "dance_song", dance: "tandava" }),
      ],
      (k) => k,
    )
    expect(found.styles).toEqual({ folk: 1, "other:baul": 2, other: 1 })
    // the same mood twice on one recording counts once; a "mood" tag is a mood
    expect(found.moods).toEqual({ joyful: 1, calm: 1 })
    expect(found.facets).toEqual({ tempo: { slow: 1 }, dance: { tandava: 1 } })
  })

  it("a library with nothing in it holds no facet at all", () => {
    expect(discoverFacets([], (k) => k)).toEqual({ styles: {}, moods: {}, facets: {} })
    expect(ids([])).toEqual(["ps:kind:mood"])
  })
})

describe("Baba's Audio Discourses appear only when they exist", () => {
  const baba = (count: number) => many(count, { kind: "baba_audio", type: "other", author: "" })

  it("no discourse, no shelf; they come, the shelf comes; they go, it goes", () => {
    expect(ids(many(5))).not.toContain("baba")
    const on = menu([...many(5), ...baba(3)])
    expect(on.result.shelves.find((s) => s.id === "baba")).toMatchObject({ count: 3, block: "baba" })
    // removed again (the recordings are gone from the library): nothing is left, so nothing is shown, hold or not
    const gone = menu(many(5), on.result.memory, NOW + DAY)
    expect(gone.result.shelves.map((s) => s.id)).not.toContain("baba")
  })

  it("follows its own knob: appears at baba.on", () => {
    const on = MENU_RULES.baba.on
    expect(ids(baba(on - 1)).includes("baba")).toBe(on - 1 > 0)
    expect(ids(baba(on))).toContain("baba")
  })
})

describe("Kiirtan styles: listed, typed and new", () => {
  it("a listed style appears at three, stays at two for the hold, leaves under two", () => {
    expect(ids(many(2, { style: "folk" }))).not.toContain("kiirtan:style:folk")
    const on = menu(many(3, { style: "folk" }))
    expect(on.result.shelves.map((s) => s.id)).toContain("kiirtan:style:folk")
    const stays = menu(many(2, { style: "folk" }), on.result.memory, NOW + DAY)
    expect(stays.result.shelves.map((s) => s.id)).toContain("kiirtan:style:folk")
    const goneAfterHold = menu(many(1, { style: "folk" }), on.result.memory, NOW + 8 * DAY)
    expect(goneAfterHold.result.shelves.map((s) => s.id)).not.toContain("kiirtan:style:folk")
    // still inside the 7-day hold with one recording left: it stays
    expect(menu(many(1, { style: "folk" }), on.result.memory, NOW + 3 * DAY).result.shelves.map((s) => s.id)).toContain("kiirtan:style:folk")
  })

  it("a style someone types as Other becomes a shelf of its own, titled from its words, once three Kiirtans carry it", () => {
    const two = menu(many(2, { style: "other", styleOther: "Baul" }))
    expect(two.result.shelves.map((s) => s.id)).not.toContain("kiirtan:style:other:baul")
    // under the threshold they live in "Other styles", counted there
    expect(two.result.shelves.find((s) => s.id === "kiirtan:style:other")).toBeUndefined() // two is under the shelf's own threshold too
    const library = [...many(2, { style: "other", styleOther: "Baul" }), ...many(1, { style: "other", styleOther: " baul " })]
    const three = menu(library)
    const shelf = three.result.shelves.find((s) => s.id === "kiirtan:style:other:baul")
    expect(shelf).toMatchObject({ count: 3, block: "kiirtan", label: { type: "named", name: "Baul" } })
    expect(shelfTitle(shelf!)).toBe("Baul")
    expect(three.result.shelves.map((s) => s.id)).not.toContain("kiirtan:style:other")
  })

  it("custom styles below the threshold fold into Other styles, and the list behind it is the same set", () => {
    const library = [...many(3, { style: "other", styleOther: "Baul" }), ...many(2, { style: "other", styleOther: "Sufi" }), ...many(1, { style: "other" }), ...many(1, { style: "other", styleOther: "Nepali" })]
    const { stats, result } = menu(library)
    const ids = result.shelves.map((s) => s.id)
    expect(ids).toContain("kiirtan:style:other:baul")
    expect(ids).not.toContain("kiirtan:style:other:sufi")
    const rest = result.shelves.find((s) => s.id === "kiirtan:style:other")
    // sufi 2 + unnamed 1 + nepali 1
    expect(rest?.count).toBe(4)
    const kirtans = library.map(toKirtan)
    expect(shelfItems("kiirtan:style:other", kirtans, stats, NOW)).toHaveLength(4)
    expect(shelfItems("kiirtan:style:other:baul", kirtans, stats, NOW)).toHaveLength(3)
  })

  it("a custom style that was a shelf falls back to Other only after the hold", () => {
    const three = menu(many(3, { style: "other", styleOther: "Baul" }))
    const two = menu(many(2, { style: "other", styleOther: "Baul" }), three.result.memory, NOW + DAY)
    expect(two.result.shelves.map((s) => s.id)).toContain("kiirtan:style:other:baul")
    const one = menu(many(1, { style: "other", styleOther: "Baul" }), three.result.memory, NOW + 9 * DAY)
    expect(one.result.shelves.map((s) => s.id)).not.toContain("kiirtan:style:other:baul")
  })

  it("an id the app has no word for still gets a shelf titled from the id", () => {
    const { result } = menu(many(3, { style: "marathi" }))
    const shelf = result.shelves.find((s) => s.id === "kiirtan:style:marathi")
    expect(shelf?.label).toEqual({ type: "kiirtanStyle", id: "marathi" })
    expect(labelFromId("kiirtan:style:other:baul")).toEqual({ type: "named", name: "Baul" })
  })
})

describe("moods are found on the recordings", () => {
  it("a mood appears at three recordings that carry it and not at two", () => {
    expect(ids(many(2, { moods: ["calm"] }))).not.toContain("theme:calm")
    expect(ids(many(3, { moods: ["calm"] }))).toContain("theme:calm")
  })

  it("a mood nobody listed becomes a chip too, with a title made from its words", () => {
    const { result } = menu(many(3, { moods: ["deep-peace"] }))
    expect(result.shelves.find((s) => s.id === "theme:deep-peace")).toMatchObject({ block: "themes", count: 3 })
    expect(shelfTitle({ id: "theme:deep-peace", label: { type: "theme", id: "deep-peace" } })).toBe("Deep Peace")
  })

  it("moods never use up the shelf cap, and with no tag there is no chip at all", () => {
    expect(menu(many(9)).result.shelves.some((s) => s.block === "themes")).toBe(false)
    const eight = Array.from({ length: 8 }, (_, i) => `mood${i}`).flatMap((m) => many(3, { moods: [m] }))
    expect(menu(eight).result.shelves.filter((s) => s.block === "themes")).toHaveLength(MENU_RULES.theme.max)
  })
})

describe("any other facet is found, never listed", () => {
  it("a tag value becomes a shelf in More ways to listen at three recordings", () => {
    expect(ids(many(2, { tags: { tempo: ["slow"] } }))).not.toContain("facet:tempo:slow")
    const { result } = menu(many(3, { tags: { tempo: ["slow"] } }))
    const shelf = result.shelves.find((s) => s.id === "facet:tempo:slow")
    expect(shelf).toMatchObject({ block: "more", facet: "tempo", count: 3, label: { type: "named", name: "Slow" } })
  })

  it("a brand new facet (solo or group, occasion, event) appears with no change in the code", () => {
    const library = [...many(3, { tags: { performance: ["Solo"], occasion: ["Full moon"] } }), ...many(4, { tags: { performance: ["group"], event: ["Ananda Purnima 2026"] } })]
    const got = menu(library).result.shelves.filter((s) => s.block === "more").map((s) => s.id)
    expect(got).toEqual(expect.arrayContaining(["facet:performance:group", "facet:performance:solo", "facet:occasion:full-moon", "facet:event:ananda-purnima-2026"]))
    expect(shelfTitle(menu(library).result.shelves.find((s) => s.id === "facet:event:ananda-purnima-2026")!)).toBe("Ananda Purnima 2026")
  })

  it("keeps at most the biggest few values of one facet, and leaves at the off threshold after the hold", () => {
    const values = Array.from({ length: 8 }, (_, i) => `v${i}`)
    const library = values.flatMap((v, i) => many(3 + i, { tags: { tempo: [v] } }))
    const got = menu(library).result.shelves.filter((s) => s.facet === "tempo")
    expect(got).toHaveLength(MENU_RULES.facet.max)
    expect(got.map((s) => s.id)).not.toContain("facet:tempo:v0")
    const on = menu(many(3, { tags: { tempo: ["slow"] } }))
    expect(menu(many(2, { tags: { tempo: ["slow"] } }), on.result.memory, NOW + DAY).result.shelves.map((s) => s.id)).toContain("facet:tempo:slow")
    expect(menu(many(1, { tags: { tempo: ["slow"] } }), on.result.memory, NOW + 8 * DAY).result.shelves.map((s) => s.id)).not.toContain("facet:tempo:slow")
  })

  it("Dance music is a block by its dances, and the list behind a shelf is the shelf's own count", () => {
    const library = [...many(3, { kind: "dance_song", type: "other", dance: "tandava" }), ...many(2, { kind: "dance_song", type: "other", dance: "kaoshiki" }), ...many(3, { tags: { tempo: ["slow"] } })]
    const { stats, result } = menu(library)
    const dance = result.shelves.filter((s) => s.block === "dance")
    expect(dance.map((s) => s.id)).toEqual(["dance:tandava"])
    const kirtans = library.map(toKirtan)
    for (const shelf of result.shelves.filter((s) => s.block === "dance" || s.block === "more")) {
      expect(shelfItems(shelf.id, kirtans, stats, NOW), shelf.id).toHaveLength(shelf.count)
    }
  })

  it("the cap drops the discovered shelves first, never Baba's voice, the collections or the moods", () => {
    const facets = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`facet${i}`, ["a", "b", "c"]]))
    const library = [
      ...many(40, { tags: facets, moods: ["calm"], style: "folk", language: "ru" }),
      ...many(3, { kind: "baba_audio", type: "other", author: "" }),
    ]
    const { result } = menu(library)
    const counted = result.shelves.filter((s) => !s.id.startsWith("ps:kind:") && s.block !== "themes")
    expect(counted.length).toBeLessThanOrEqual(MENU_RULES.maxShelves)
    expect(result.shelves.map((s) => s.id)).toEqual(expect.arrayContaining(["baba", "theme:calm", "ps:kind:mood"]))
  })
})

describe("the preview library is just a library", () => {
  const base = KIRTAN_FIXTURES.filter((k) => k.status === "published")

  it("without discourses the preview shows no Baba shelf and no demo discourse exists in it", () => {
    for (const stage of ["nobaba", "newstyle"] as const) {
      expect(stageHasBaba(stage)).toBe(false)
      const lib = demoCatalog(base, stage)
      expect(lib.some((k) => k.kind === "baba_audio")).toBe(false)
      expect(buildMenu(aggregateRecordings(lib.map(toMenuRecording), NOW, { psCollections: PS })).shelves.map((s) => s.id)).not.toContain("baba")
    }
  })

  it("the grown stage holds demo discourses, titled Demo, and the shelf comes from them", () => {
    const lib = demoCatalog(base, "grown")
    const baba = lib.filter((k) => k.kind === "baba_audio")
    expect(baba.length).toBeGreaterThanOrEqual(3)
    expect(baba.every((k) => k.title.startsWith("Demo"))).toBe(true)
    expect(buildMenu(aggregateRecordings(lib.map(toMenuRecording), NOW, { psCollections: PS })).shelves.map((s) => s.id)).toContain("baba")
  })

  it("the newstyle stage adds shelves nobody listed: a typed style and tags", () => {
    const shelves = buildMenu(aggregateRecordings(demoCatalog(base, "newstyle").map(toMenuRecording), NOW, { psCollections: PS })).shelves.map((s) => s.id)
    const plain = buildMenu(aggregateRecordings(demoCatalog(base, "nobaba").map(toMenuRecording), NOW, { psCollections: PS })).shelves.map((s) => s.id)
    expect(shelves).toContain("kiirtan:style:other:baul")
    expect(shelves).toContain("facet:performance:group")
    expect(plain).not.toContain("kiirtan:style:other:baul")
    expect(plain).not.toContain("facet:performance:group")
  })
})

function toKirtan(r: MenuRecording, i: number): MenuKirtan {
  return {
    id: `r${i}`, kind: r.kind as MenuKirtan["kind"], title: `T${i}`, author: r.author, durationSec: 60, type: (r.type ?? "other") as MenuKirtan["type"],
    audioUrl: null, thumbnailUrl: null, addedBy: "x", status: "published", addedAt: r.createdAt,
    style: r.style ?? undefined, styleOther: r.styleOther ?? undefined, dance: (r.dance ?? undefined) as MenuKirtan["dance"], moods: r.moods ?? null, tags: r.tags ?? null,
    ...(r.language ? { language: r.language } : {}),
  }
}
