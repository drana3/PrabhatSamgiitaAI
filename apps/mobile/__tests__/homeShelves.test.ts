import { describe, expect, it } from "vitest"

import {
  HOME_COVER_IDS,
  HOME_FILTERS,
  chunk,
  coverFor,
  isHomeFilter,
  mergeStartRows,
  shelvesFor,
  songSub,
  stripColors,
} from "@/lib/homeShelves"

describe("home shelves", () => {
  it("All shows every shelf and each chip has its own", () => {
    expect(shelvesFor("all")).toEqual(["today", "start", "kmixes", "kiirtan", "mixes", "because", "trending", "stories", "learn"])
    expect(shelvesFor("kiirtan")).toEqual(["kiirtan", "kmixes"])
    expect(shelvesFor("stories")).toEqual(["stories"])
    expect(shelvesFor("learn")).toEqual(["learn"])
    expect(shelvesFor("downloaded")).toEqual(["downloaded"])
    expect(shelvesFor("songs")).not.toContain("stories")
    expect(shelvesFor("songs")).not.toContain("kiirtan")
  })

  it("knows the six chips", () => {
    expect(HOME_FILTERS.map((f) => f.label)).toEqual(["All", "Songs", "Kiirtan", "Stories", "Learn", "Downloaded"])
    expect(isHomeFilter("songs")).toBe(true)
    expect(isHomeFilter("podcasts")).toBe(false)
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

import { HOME_BECAUSE, HOME_MIXES, SEARCH_BROWSE_ALL, SEARCH_TOP_TILES } from "@/lib/fixtures/home"
import { inboxFixtures } from "@/lib/fixtures/notifications"
import { sectionsOf } from "@/lib/notifications"

describe("home fixtures", () => {
  it("has the four mixes with a strip each and songs with titles", () => {
    expect(HOME_MIXES.map((m) => m.label)).toEqual(["Songs for today", "Raga mix", "Festival mix", "Morning songs"])
    expect(HOME_BECAUSE.every((s) => s.title.length > 0 && s.sub.startsWith("PS "))).toBe(true)
  })
  it("has the search tiles and no two neighbours in Browse all share a tone", () => {
    expect(SEARCH_TOP_TILES.map((t) => t.label)).toEqual(["Songs", "Stories", "Learn", "Kiirtans"])
    expect(SEARCH_BROWSE_ALL).toHaveLength(10)
    SEARCH_BROWSE_ALL.forEach((t, i) => {
      if (i % 2 === 0) expect(SEARCH_BROWSE_ALL[i + 1].tone).not.toBe(t.tone)
      if (i + 2 < SEARCH_BROWSE_ALL.length) expect(SEARCH_BROWSE_ALL[i + 2].tone).not.toBe(t.tone)
    })
  })
  it("fills the Earlier notifications", () => {
    const now = new Date(2026, 10, 5, 12).getTime()
    expect(sectionsOf(inboxFixtures(now), now).map((s) => s.label)).toEqual(["Earlier"])
  })
})
