import { describe, expect, it } from "vitest"

import {
  HOME_COVER_IDS,
  HOME_FILTERS,
  chunk,
  coverFor,
  interleave,
  isHomeFilter,
  mergeStartRows,
  mixKindsFor,
  shelvesFor,
  songSub,
  stripColors,
} from "@/lib/homeShelves"

describe("home shelves", () => {
  it("All shows every shelf and each chip has its own", () => {
    expect(shelvesFor("all")).toEqual(["festcard", "today", "start", "mixes", "kiirtan", "because", "spiritual", "trending", "spiritualNew", "stories", "festivals", "learn"])
    expect(shelvesFor("kiirtan")).toEqual(["kiirtan", "mixes", "spiritual", "spiritualNew"])
    expect(shelvesFor("festivals")).toEqual(["festcard", "festivals"])
    expect(shelvesFor("stories")).toEqual(["stories"])
    expect(shelvesFor("learn")).toEqual(["learn"])
    expect(shelvesFor("songs")).not.toContain("stories")
    expect(shelvesFor("songs")).not.toContain("kiirtan")
  })

  it("knows the six chips: Festivals is new, Downloaded is gone", () => {
    expect(HOME_FILTERS.map((f) => f.label)).toEqual(["All", "Songs", "Kiirtan", "Festivals", "Stories", "Learn"])
    expect(isHomeFilter("songs")).toBe(true)
    expect(isHomeFilter("festivals")).toBe(true)
    expect(isHomeFilter("downloaded")).toBe(false)
    expect(isHomeFilter("podcasts")).toBe(false)
  })

  it("puts the festival card first wherever it can show, and the spiritual shelves next to Prabhat Samgiita and Kiirtan", () => {
    for (const filter of ["all", "songs", "festivals"] as const) expect(shelvesFor(filter)[0]).toBe("festcard")
    const all = shelvesFor("all")
    for (const id of ["today", "kiirtan", "spiritual", "spiritualNew"] as const) expect(all).toContain(id)
    expect(all.indexOf("spiritual")).toBeLessThan(all.indexOf("stories"))
    expect(shelvesFor("kiirtan")).toContain("spiritual")
  })

  it("has one shelf of mixes, never the old two, and no top lists", () => {
    for (const filter of HOME_FILTERS.map((f) => f.id)) {
      const shelves = shelvesFor(filter) as readonly string[]
      expect(shelves.filter((id) => id === "mixes").length).toBeLessThanOrEqual(1)
      expect(shelves).not.toContain("kmixes")
      expect(shelves).not.toContain("downloaded")
      expect(shelves.some((id) => id.startsWith("top"))).toBe(false)
    }
  })

  it("fills the one mixes shelf by chip: Songs the Prabhat Samgiita mixes, Kiirtan the Kiirtan mixes, All both", () => {
    expect(mixKindsFor("all")).toEqual({ songs: true, kiirtan: true })
    expect(mixKindsFor("songs")).toEqual({ songs: true, kiirtan: false })
    expect(mixKindsFor("kiirtan")).toEqual({ songs: false, kiirtan: true })
  })

  it("lays two lists in turns", () => {
    expect(interleave<number | string>([1, 2, 3], ["a", "b"])).toEqual([1, "a", 2, "b", 3])
    expect(interleave<string>([], ["a"])).toEqual(["a"])
    expect(interleave<number>([1], [])).toEqual([1])
  })

  it("chunks rows into pages of three", () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]])
    expect(chunk([], 3)).toEqual([])
    expect(chunk([1], 0)).toEqual([])
  })

  it("merges start rows without repeats and respects the limit", () => {
    const r = (number: number) => ({ number, title: `T${number}`, sub: `PS ${number}` })
    const rows = mergeStartRows([[r(6)], [r(1), r(6), r(4)], [r(3), r(1), r(5)]], 4)
    expect(rows.map((x) => x.number)).toEqual([6, 1, 4, 3])
  })

  it("picks a stable cover for a song", () => {
    expect(coverFor(3)).toBe(coverFor(3))
    for (const n of [0, 1, 6, 5011, -4]) expect(HOME_COVER_IDS).toContain(coverFor(n))
    expect(new Set([1, 2, 3, 4, 5, 6].map(coverFor)).size).toBeGreaterThan(3)
  })

  it("writes the song line", () => {
    expect(songSub(3, "4:31")).toBe("PS 3 · 4:31")
    expect(songSub(3)).toBe("PS 3")
  })

  it("keeps strip text legible", () => {
    expect(stripColors("orange", false).fg).toBe("#1E1E1E")
    expect(stripColors("sage", true).fg).toBe("#FFFFFF")
    expect(stripColors("forest", true).bg).not.toBe(stripColors("forest", false).bg)
  })
})

import { HOME_BECAUSE, HOME_MIXES, SEARCH_TOP_TILES } from "@/lib/fixtures/home"
import { inboxFixtures } from "@/lib/fixtures/notifications"
import { sectionsOf } from "@/lib/notifications"

describe("home fixtures", () => {
  it("has the four mixes with a strip each and songs with titles", () => {
    expect(HOME_MIXES.map((m) => m.label)).toEqual(["Songs for today", "Raga mix", "Festival mix", "Morning songs"])
    expect(HOME_BECAUSE.every((s) => s.title.length > 0 && s.sub.startsWith("PS "))).toBe(true)
  })
  it("has the four top search tiles (Browse all is built from real data, see searchBrowse.test)", () => {
    expect(SEARCH_TOP_TILES.map((t) => t.label)).toEqual(["Songs", "Stories", "Learn", "Kiirtans"])
  })
  it("fills the Earlier notifications", () => {
    const now = new Date(2026, 10, 5, 12).getTime()
    expect(sectionsOf(inboxFixtures(now), now).map((s) => s.label)).toEqual(["Earlier"])
  })
})
