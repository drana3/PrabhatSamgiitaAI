import { describe, expect, it } from "vitest"

import { displayTitle, formatDuration, groupLetter, plainTitle, rowEyebrow, summaryToEntry, type CatalogEntry } from "@/lib/songsV2/entry"
import {
  availableSortOptions,
  buildRows,
  DEFAULT_SORT,
  isGroupedSort,
  resolveSort,
  SORT_OPTIONS,
  sortEntries,
} from "@/lib/songsV2/sort"
import { groupChanged, railFraction, railLabelAt, railRowIndex, railVisible, rowFraction } from "@/lib/songsV2/rail"

function entry(number: number, title: string, extra: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    number,
    title,
    firstLine: null,
    category: "Devotion",
    language: null,
    durationSeconds: null,
    hasAudio: null,
    hasDevanagari: null,
    addedRank: null,
    plays: null,
    ...extra,
  }
}

describe("entry helpers", () => {
  it("maps a catalog summary and never invents a duration", () => {
    const e = summaryToEntry(
      { number: 3, title: "Ándhára Sheśe", first_line: " x ", theme: null, mood: "Dawn", language: "Roman", is_verified: true },
      { hasAudio: (n) => n === 3 },
    )
    expect(e.category).toBe("Dawn")
    expect(e.durationSeconds).toBeNull()
    expect(e.hasAudio).toBe(true)
    expect(e.firstLine).toBe("x")
  })

  it("falls back to Other when no theme or mood", () => {
    expect(summaryToEntry({ number: 1, title: "x", is_verified: false }).category).toBe("Other")
  })

  it("shows capital-letter catalog titles as names and leaves mixed case alone", () => {
    expect(displayTitle("BANDHU HE NIYE CALO")).toBe("Bandhu He Niye Calo")
    expect(displayTitle("E GÁN ÁMÁR, ÁLOR JHARAŃÁ DHÁRÁ")).toBe("E Gán Ámár, Álor Jharańá Dhárá")
    expect(displayTitle("Ándhára Sheśe")).toBe("Ándhára Sheśe")
    expect(displayTitle("")).toBe("")
  })

  it("formats durations", () => {
    expect(formatDuration(271)).toBe("4:31")
    expect(formatDuration(60)).toBe("1:00")
    expect(formatDuration(null)).toBeNull()
    expect(formatDuration(0)).toBeNull()
  })

  it("builds the row eyebrow", () => {
    expect(rowEyebrow({ number: 3, durationSeconds: 271 })).toBe("PS 3 · 4:31")
    expect(rowEyebrow({ number: 3, durationSeconds: null })).toBe("PS 3")
    expect(rowEyebrow({ number: 3, durationSeconds: 271 }, true)).toBe("PS 3 · 4:31 · Offline")
  })

  it("folds diacritics for ordering and the rail letter", () => {
    expect(plainTitle("Ándhára")).toBe("andhara")
    expect(plainTitle("“Śiva")).toBe("siva")
    expect(groupLetter("Śrii")).toBe("S")
    expect(groupLetter("5 stars")).toBe("#")
  })
})

describe("sorting", () => {
  const list = [
    entry(30, "Zephyr", { category: "Nature", durationSeconds: 400, plays: 5, addedRank: 2 }),
    entry(10, "Ánanda", { category: "Devotion", durationSeconds: 120, plays: 50, addedRank: 9 }),
    entry(20, "Bandhu", { category: "Devotion", durationSeconds: 300, plays: null, addedRank: null }),
  ]

  it("has nine options and a number default", () => {
    expect(SORT_OPTIONS).toHaveLength(9)
    expect(DEFAULT_SORT).toBe("num")
  })

  it("sorts by number both ways", () => {
    expect(sortEntries(list, "num").map((e) => e.number)).toEqual([10, 20, 30])
    expect(sortEntries(list, "numd").map((e) => e.number)).toEqual([30, 20, 10])
  })

  it("sorts titles with diacritics folded", () => {
    expect(sortEntries(list, "az").map((e) => e.number)).toEqual([10, 20, 30])
    expect(sortEntries(list, "za").map((e) => e.number)).toEqual([30, 20, 10])
  })

  it("sorts by category then title", () => {
    expect(sortEntries(list, "cat").map((e) => e.number)).toEqual([10, 20, 30])
  })

  it("sorts by length with unknown last", () => {
    const withUnknown = [...list, entry(5, "Unknown")]
    expect(sortEntries(withUnknown, "short").map((e) => e.number)).toEqual([10, 20, 30, 5])
    expect(sortEntries(withUnknown, "long").map((e) => e.number)).toEqual([30, 20, 10, 5])
  })

  it("sorts recent and popular, unknown last", () => {
    expect(sortEntries(list, "new").map((e) => e.number)).toEqual([10, 30, 20])
    expect(sortEntries(list, "most").map((e) => e.number)).toEqual([10, 30, 20])
  })

  it("does not mutate the input", () => {
    const copy = [...list]
    sortEntries(list, "za")
    expect(list).toEqual(copy)
  })
})

describe("sort availability", () => {
  it("hides sorts the data cannot support", () => {
    const keys = availableSortOptions([entry(1, "a")]).map((o) => o.key)
    expect(keys).toEqual(["num", "numd", "az", "za", "cat"])
  })
  it("offers all nine when data exists", () => {
    const rich = entry(1, "a", { durationSeconds: 100, addedRank: 1, plays: 1 })
    expect(availableSortOptions([rich])).toHaveLength(9)
  })
  it("falls back to the default for a remembered sort that is gone", () => {
    const options = availableSortOptions([entry(1, "a")])
    expect(resolveSort("most", options)).toBe("num")
    expect(resolveSort("az", options)).toBe("az")
    expect(resolveSort("nonsense", options)).toBe("num")
  })
})

describe("rows and groups", () => {
  const list = [entry(1, "Bandhu"), entry(2, "Ánanda"), entry(3, "Aruna"), entry(4, "Candra")]

  it("inserts a header before each A to Z group", () => {
    const { rows, groups } = buildRows(list, "az")
    expect(isGroupedSort("az")).toBe(true)
    expect(groups.map((g) => g.label)).toEqual(["A", "B", "C"])
    expect(rows.map((r) => (r.kind === "header" ? `#${r.label}` : r.entry.number))).toEqual([
      "#A", 2, 3, "#B", 1, "#C", 4,
    ])
    expect(groups.map((g) => g.rowIndex)).toEqual([0, 3, 5])
  })

  it("adds no headers for number sorting and labels rows with the PS number", () => {
    const { rows, groups } = buildRows(list, "num")
    expect(groups).toHaveLength(0)
    expect(rows.every((r) => r.kind === "song")).toBe(true)
    const first = rows[0]
    expect(first.kind === "song" && first.railLabel).toBe("PS 1")
  })

  it("labels length sorts with the duration", () => {
    const { rows } = buildRows([entry(1, "a", { durationSeconds: 271 })], "short")
    expect(rows[0].kind === "song" && rows[0].railLabel).toBe("4:31")
  })

  it("groups by category", () => {
    const { groups } = buildRows([entry(1, "a", { category: "Nature" }), entry(2, "b", { category: "Light" })], "cat")
    expect(groups.map((g) => g.label)).toEqual(["Light", "Nature"])
  })

  it("handles an empty list", () => {
    expect(buildRows([], "az")).toEqual({ rows: [], groups: [] })
  })
})

describe("fast-scroll rail", () => {
  it("maps finger to fraction and clamps", () => {
    expect(railFraction(50, 100)).toBe(0.5)
    expect(railFraction(-20, 100)).toBe(0)
    expect(railFraction(500, 100)).toBe(1)
    expect(railFraction(10, 0)).toBe(0)
  })
  it("maps fraction to row index", () => {
    expect(railRowIndex(0, 101)).toBe(0)
    expect(railRowIndex(0.5, 101)).toBe(50)
    expect(railRowIndex(1, 101)).toBe(100)
    expect(railRowIndex(2, 101)).toBe(100)
    expect(railRowIndex(0.5, 0)).toBe(0)
  })
  it("round-trips thumb position", () => {
    expect(rowFraction(50, 101)).toBe(0.5)
    expect(rowFraction(0, 1)).toBe(0)
  })
  it("reads the bubble label and detects group changes", () => {
    const { rows } = buildRows([entry(1, "Bandhu"), entry(2, "Ánanda"), entry(3, "Aruna")], "az")
    expect(railLabelAt(rows, 0)).toBe("A")
    expect(railLabelAt(rows, 1)).toBe("A")
    expect(railLabelAt(rows, 3)).toBe("B")
    expect(groupChanged(rows, 1, 2)).toBe(false)
    expect(groupChanged(rows, 2, 3)).toBe(true)
    expect(railLabelAt([], 0)).toBe("")
  })
  it("hides the rail in short lists", () => {
    expect(railVisible(5)).toBe(false)
    expect(railVisible(60)).toBe(true)
  })
})
