import { describe, expect, it } from "vitest"

import { SAMPLE_LEARN_WORDS } from "@/data/learnWords"
import { buildLearnDemoSeed } from "@/lib/fixtures/learn"
import { buildLibraryRows, filterLibraryRows, libraryCounts, libraryEmptyText } from "@/lib/learn/library"

const NOW = new Date(2026, 10, 3, 9, 0, 0).getTime()
const seed = buildLearnDemoSeed(NOW)
const rows = buildLibraryRows({ songs: seed.songs, paths: seed.paths, cards: seed.cards, words: SAMPLE_LEARN_WORDS, now: NOW, mockup: true })

describe("songs list (old My songs tab)", () => {
  it("has one row per listed song with the prototype's states", () => {
    expect(rows.map((r) => r.number)).toEqual([2, 4, 6, 1, 3])
    expect(libraryCounts(rows)).toEqual({ learned: 3, learning: 2, total: 5 })
    expect(rows.find((r) => r.number === 4)).toMatchObject({ learned: true, due: true, note: "Review due today" })
    expect(rows.find((r) => r.number === 2)?.note).toBe("Next review in 6 days")
    expect(rows.find((r) => r.number === 3)?.note).toBe("Step 3 of 3 · play it")
  })

  it("filters All, Due, Learning, Learned", () => {
    expect(filterLibraryRows(rows, "all")).toHaveLength(5)
    expect(filterLibraryRows(rows, "due").map((r) => r.number)).toEqual([4])
    expect(filterLibraryRows(rows, "learning").map((r) => r.number)).toEqual([1, 3])
    expect(filterLibraryRows(rows, "learned").map((r) => r.number)).toEqual([2, 4, 6])
  })

  it("gives a friendly empty text for each case", () => {
    expect(libraryEmptyText(0)).toContain("No songs yet")
    expect(libraryEmptyText(5, "due")).toContain("nothing due")
    expect(libraryEmptyText(5, "learning")).toContain("Nothing in progress")
    expect(libraryEmptyText(5, "learned")).toContain("No song is fully learned")
  })

  it("works with no learning data", () => {
    expect(buildLibraryRows({ songs: [], paths: {}, cards: {}, words: SAMPLE_LEARN_WORDS, now: NOW, mockup: false })).toEqual([])
  })
})

describe("unverified learn content", () => {
  it("never shows the prototype's demo due or strength in a real build", () => {
    const real = buildLibraryRows({ songs: seed.songs, paths: seed.paths, cards: {}, words: [], now: NOW, mockup: false })
    expect(real.every((row) => row.strength === undefined)).toBe(true)
    expect(real.some((row) => row.due)).toBe(false)
  })
})
