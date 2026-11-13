import { describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}))

vi.mock("@/lib/client", () => ({ api: { fetchSongs: vi.fn() } }))

import { mergeMeaningRows, searchLocal, matchingCollections } from "@/lib/unifiedSearch"
import { reasonLabel } from "@/lib/unifiedSearchQuery"

const ids = (result: ReturnType<typeof searchLocal>) =>
  result.groups.map((group) => group.id)

describe("searchLocal (bundled catalog)", () => {
  it("typing a number returns that song under Exact number", () => {
    const result = searchLocal("3")
    expect(ids(result)).toEqual(["number"])
    expect(result.groups[0].items[0].song.number).toBe(3)
    expect(reasonLabel(result.groups[0].items[0].reason)).toBe("Number match")
  })

  it("explains a number outside the catalog instead of showing an empty list", () => {
    const result = searchLocal("9999")
    expect(result.total).toBe(0)
    expect(result.message).toContain("5018")
  })

  it("finds the opening line, tagged First line match", () => {
    const result = searchLocal("bandhu he niye calo")
    expect(ids(result)[0]).toBe("lyrics")
    const top = result.groups[0].items[0]
    expect(top.song.number).toBe(1)
    expect(reasonLabel(top.reason)).toBe("First line match")
  })

  it("finds PS 1 by the word gloss 'friend'", () => {
    const result = searchLocal("friend")
    const numbers = result.groups.flatMap((g) => g.items.map((i) => i.song.number))
    expect(numbers).toContain(1)
  })

  it("answers 'peaceful devotion' for a guest from the bundled mood lists", () => {
    const result = searchLocal("peaceful devotion")
    const meaning = result.groups.find((g) => g.id === "meaning")
    expect(meaning?.items.length).toBeGreaterThan(0)
    expect(meaning?.items.some((i) => reasonLabel(i.reason).startsWith("Feeling: "))).toBe(true)
    expect(result.wantsMeaning).toBe(true)
  })

  it("lists each song once, in the spec group order", () => {
    const result = searchLocal("peaceful devotion")
    const all = result.groups.flatMap((g) => g.items.map((i) => i.song.number))
    expect(new Set(all).size).toBe(all.length)
    const order = ["number", "lyrics", "meaning", "collections"]
    const positions = ids(result).map((id) => order.indexOf(id))
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it("puts the Answer card first for a question and keeps source songs", () => {
    const result = searchLocal("which song helps with peace?")
    expect(result.answer).not.toBeNull()
    expect(result.answer?.sources.length).toBeGreaterThan(0)
  })

  it("returns nothing for an empty field", () => {
    const result = searchLocal("  ")
    expect(result.groups).toEqual([])
    expect(result.message).toBeNull()
  })

  it("lists a collection's songs when its name is typed", () => {
    const result = searchLocal("Hindi")
    expect(result.groups.some((g) => g.id === "collections")).toBe(true)
  })
})

describe("matchingCollections", () => {
  it("ignores one or two letters", () => {
    expect(matchingCollections("hi")).toEqual([])
  })
})

describe("mergeMeaningRows", () => {
  it("adds server rows to Matches by meaning without duplicating a song", () => {
    const base = searchLocal("peaceful devotion")
    const known = base.groups.flatMap((g) => g.items.map((i) => i.song.number))
    const merged = mergeMeaningRows(
      base,
      [
        { number: known[0], title: "dup", first_line: null, is_verified: true },
        { number: 4999, title: "New one", first_line: "a line", is_verified: true },
      ],
      20,
    )
    const numbers = merged.groups.flatMap((g) => g.items.map((i) => i.song.number))
    expect(numbers.filter((n) => n === known[0])).toHaveLength(1)
    expect(numbers).toContain(4999)
  })

  it("creates the group when the local search found nothing by meaning", () => {
    const base = searchLocal("zzqx vvkk")
    const merged = mergeMeaningRows(base, [
      { number: 12, title: "Twelve", first_line: null, is_verified: true },
    ])
    expect(merged.groups.map((g) => g.id)).toEqual(["meaning"])
    expect(reasonLabel(merged.groups[0].items[0].reason)).toBe("Meaning match")
    expect(merged.message).toBeNull()
  })

  it("returns the same result when there are no rows", () => {
    const base = searchLocal("friend")
    expect(mergeMeaningRows(base, [])).toBe(base)
  })
})

import { singleWordGlossHits } from "@/lib/lyricSearch"

describe("singleWordGlossHits", () => {
  const rows = [
    { n: 1, t: "A", o: "A", b: "a", e: "o dearest friend lead me on o dearest friend" },
    { n: 2, t: "B", o: "B", b: "b", e: "my friends gather at dawn" },
    { n: 3, t: "C", o: "C", b: "c", e: "the river flows" },
  ]

  it("ranks by uses and accepts longer forms of the word", () => {
    expect(singleWordGlossHits("friend", rows).map((h) => h.number)).toEqual([1, 2])
  })

  it("ignores words shorter than four letters and rows with no gloss", () => {
    expect(singleWordGlossHits("lea", rows)).toEqual([])
    expect(singleWordGlossHits("river", [{ n: 9, t: "", o: "", b: "" }])).toEqual([])
  })
})
