import { describe, expect, it } from "vitest"

import type { CatalogEntry } from "@/lib/songsV2/entry"
import { rowMetrics, SONGS_LAYOUT } from "@/lib/songsV2/layout"
import {
  compactNumber,
  DEFAULT_ROW_STYLE,
  groupedForStyle,
  isRowStyle,
  listPageRowHeight,
  normalizeRowStyle,
  numberRailMarks,
  ROW_GEOMETRY,
  ROW_STYLE_OPTIONS,
  rowMeta,
  rowsForStyle,
  slotHeight,
} from "@/lib/songsV2/rowStyles"
import type { ListRow } from "@/lib/songsV2/sort"

function entry(number: number): CatalogEntry {
  return {
    number,
    title: `Song ${number}`,
    firstLine: null,
    category: "Devotion",
    language: null,
    durationSeconds: null,
    hasAudio: null,
    hasDevanagari: null,
    addedRank: null,
    plays: null,
  }
}
const song = (number: number): ListRow => ({ kind: "song", id: `s:${number}`, entry: entry(number), groupIndex: 0, railLabel: `PS ${number}` })
const header = (label: string): ListRow => ({ kind: "header", id: `h:${label}`, label, groupIndex: 0 })
const run = (from: number, to: number): ListRow[] => {
  const out: ListRow[] = []
  const step = from <= to ? 1 : -1
  for (let n = from; n !== to + step; n += step) out.push(song(n))
  return out
}

describe("row style setting", () => {
  it("defaults to Compact and lists the three options in order", () => {
    expect(DEFAULT_ROW_STYLE).toBe("compact")
    expect(ROW_STYLE_OPTIONS.map((o) => o.label)).toEqual(["Tracklist", "Compact", "Cards"])
  })

  it("accepts only the three ids", () => {
    expect(isRowStyle("compact")).toBe(true)
    expect(isRowStyle("grid")).toBe(false)
    expect(normalizeRowStyle("cards")).toBe("cards")
    expect(normalizeRowStyle(undefined)).toBe("compact")
    expect(normalizeRowStyle(3)).toBe("compact")
  })
})

describe("row geometry", () => {
  it("Tracklist rows are 56 high with no gap, Compact 44 plus 6, Cards 76 plus 10", () => {
    expect(slotHeight("tracklist", "song")).toBe(56)
    expect(slotHeight("compact", "song")).toBe(50)
    expect(slotHeight("cards", "song")).toBe(86)
  })

  it("Compact draws no header", () => {
    expect(ROW_GEOMETRY.compact.header).toBe(0)
    expect(slotHeight("compact", "header")).toBe(0)
    expect(groupedForStyle(true, "compact")).toBe(false)
    expect(groupedForStyle(true, "tracklist")).toBe(true)
    expect(groupedForStyle(false, "cards")).toBe(false)
  })

  it("list pages keep the 64px picture row for Cards", () => {
    expect(listPageRowHeight("cards")).toBe(64)
    expect(listPageRowHeight("tracklist")).toBe(56)
    expect(listPageRowHeight("compact")).toBe(50)
  })

  it("rowMetrics keeps the Cards numbers by default and follows the style otherwise", () => {
    const rows = [header("A"), song(1), song(2)]
    const cards = rowMetrics(rows, 100)
    expect(cards.heights).toEqual([SONGS_LAYOUT.header + SONGS_LAYOUT.gap, 86, 86])
    expect(cards.offsets).toEqual([100, 162, 248])
    const track = rowMetrics(rows, 100, "tracklist")
    expect(track.heights).toEqual([56, 56, 56])
    expect(track.total).toBe(168)
    const compact = rowMetrics(rowsForStyle(rows, "compact") as ListRow[], 0, "compact")
    expect(compact.heights).toEqual([50, 50])
  })
})

describe("rowsForStyle", () => {
  it("drops headers for Compact and nothing else", () => {
    const rows = [header("A"), song(1), header("B"), song(2)]
    expect(rowsForStyle(rows, "compact").map((r) => r.id)).toEqual(["s:1", "s:2"])
    expect(rowsForStyle(rows, "tracklist")).toBe(rows)
    expect(rowsForStyle(rows, "cards")).toBe(rows)
  })

  it("returns the same array when there is nothing to drop", () => {
    const rows = [song(1), song(2)]
    expect(rowsForStyle(rows, "compact")).toBe(rows)
  })
})

describe("compactNumber", () => {
  it("fits three characters", () => {
    expect(compactNumber(1)).toBe("1")
    expect(compactNumber(480)).toBe("480")
    expect(compactNumber(999)).toBe("999")
    expect(compactNumber(1004)).toBe("1k")
    expect(compactNumber(2510)).toBe("3k")
    expect(compactNumber(5018)).toBe("5k")
    expect(compactNumber(Number.NaN)).toBe("")
  })
})

describe("numberRailMarks", () => {
  it("marks the whole catalogue 1, 1k ... 5k at their places", () => {
    const marks = numberRailMarks(run(1, 5018))
    expect(marks?.map((m) => m.label)).toEqual(["1", "1k", "2k", "3k", "4k", "5k"])
    expect(marks?.[0].y).toBe(3)
    expect(marks?.[5].y).toBe(97)
    expect(marks?.[2].y).toBeCloseTo(40, 5)
    expect(marks?.every((m) => !m.dot)).toBe(true)
  })

  it("runs backwards for the reversed order", () => {
    const marks = numberRailMarks(run(5018, 1))
    expect(marks?.map((m) => m.label)).toEqual(["5k", "4k", "3k", "2k", "1k", "1"])
  })

  it("is null for short lists and for orders that do not follow the numbers", () => {
    expect(numberRailMarks(run(1, 30))).toBeNull()
    const shuffled = run(1, 400).sort((a, b) => ((a.kind === "song" ? a.entry.number : 0) * 7919) % 401 - ((b.kind === "song" ? b.entry.number : 0) * 7919) % 401)
    expect(numberRailMarks(shuffled)).toBeNull()
  })

  it("ignores headers", () => {
    const rows = [header("A"), ...run(1, 100)]
    expect(numberRailMarks(rows)?.[0].label).toBe("1")
  })
})

describe("rowMeta", () => {
  it("shows the length, then the markers", () => {
    expect(rowMeta({ durationSeconds: 238, category: "Devotion" }, { offline: true, saved: true })).toBe("3:58 · Offline · Mine")
    expect(rowMeta({ durationSeconds: 238, category: "Devotion" })).toBe("3:58")
  })

  it("falls back to the category without a length, and to nothing for Other", () => {
    expect(rowMeta({ durationSeconds: null, category: "Devotion" }, { saved: true })).toBe("Devotion · Mine")
    expect(rowMeta({ durationSeconds: null, category: "Other" })).toBe("")
    expect(rowMeta({ durationSeconds: null, category: "Other" }, { offline: true })).toBe("Offline")
  })
})
