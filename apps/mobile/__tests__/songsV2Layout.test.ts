import { describe, expect, it } from "vitest"

import { fixtureAddedRank, fixturePlays, fixtureSeconds, withFixtureStats } from "@/lib/fixtures/songs"
import type { CatalogEntry } from "@/lib/songsV2/entry"
import {
  isStripStuck,
  railJump,
  railTicks,
  rowMetrics,
  scrollOffsetForRow,
  SONGS_LAYOUT,
  songsSpots,
  stickyY,
} from "@/lib/songsV2/layout"
import type { ListRow, RailGroup } from "@/lib/songsV2/sort"

function entry(number: number, extra: Partial<CatalogEntry> = {}): CatalogEntry {
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
    ...extra,
  }
}

const header = (label: string, groupIndex: number): ListRow => ({ kind: "header", id: `h-${label}`, label, groupIndex })
const song = (number: number, groupIndex: number, railLabel = "A"): ListRow => ({
  kind: "song",
  id: `s-${number}`,
  entry: entry(number),
  groupIndex,
  railLabel,
})

describe("songsSpots", () => {
  it("places the pill, seg and strip under the 54px status area of the board", () => {
    const s = songsSpots(54)
    expect(s.pillTop).toBe(54 + 56 + 122)
    expect(s.segTop).toBe(s.pillTop + 64 + 4)
    expect(s.stripTop).toBe(s.segTop + 56 + 12)
    expect(s.listTop).toBe(s.stripTop + 52 + 64)
    expect(s.plainTop).toBe(s.segTop + 56)
  })

  it("moves everything by the inset", () => {
    expect(songsSpots(60).listTop - songsSpots(54).listTop).toBe(6)
  })
})

describe("sticky blocks", () => {
  it("follows the scroll until it reaches the pin, then stays", () => {
    expect(stickyY(300, 0, 54)).toBe(300)
    expect(stickyY(300, 100, 54)).toBe(200)
    expect(stickyY(300, 246, 54)).toBe(54)
    expect(stickyY(300, 900, 54)).toBe(54)
  })

  it("calls the strip stuck only after it pinned and the list moved", () => {
    expect(isStripStuck(0, 300, 118)).toBe(false)
    expect(isStripStuck(100, 300, 118)).toBe(false)
    expect(isStripStuck(182, 300, 118)).toBe(true)
    expect(isStripStuck(2, 100, 118)).toBe(false)
  })
})

describe("rowMetrics", () => {
  it("gives songs 86 and headers 62 (card or header plus the 10px gap)", () => {
    const rows = [header("A", 0), song(1, 0), song(2, 0), header("B", 1), song(3, 1)]
    const m = rowMetrics(rows, 100)
    expect(m.heights).toEqual([62, 86, 86, 62, 86])
    expect(m.offsets).toEqual([100, 162, 248, 334, 396])
    expect(m.total).toBe(382)
  })

  it("handles an empty list", () => {
    expect(rowMetrics([], 40)).toEqual({ heights: [], offsets: [], total: 0 })
  })
})

describe("scrollOffsetForRow", () => {
  it("lands a row right under the pinned strip and never goes negative", () => {
    expect(scrollOffsetForRow(1000, 54)).toBe(1000 - (54 + SONGS_LAYOUT.stripPin + SONGS_LAYOUT.strip - 4))
    expect(scrollOffsetForRow(20, 54)).toBe(0)
  })
})

describe("railTicks", () => {
  const groups: RailGroup[] = [
    { label: "A", rowIndex: 0 },
    { label: "B", rowIndex: 5 },
    { label: "C", rowIndex: 9 },
    { label: "D", rowIndex: 12 },
  ]

  it("centres one tick per group down the rail", () => {
    const ticks = railTicks(groups, true, false)
    expect(ticks.map((t) => t.label)).toEqual(["A", "B", "C", "D"])
    expect(ticks[0].y).toBeCloseTo(12.5)
    expect(ticks[3].y).toBeCloseTo(87.5)
    expect(ticks.every((t) => !t.dot)).toBe(true)
  })

  it("shortens category names to three letters", () => {
    const ticks = railTicks([{ label: "Devotion", rowIndex: 0 }], true, true)
    expect(ticks[0].label).toBe("Dev")
  })

  it("draws five dots when the order has no groups", () => {
    const ticks = railTicks([], false, false)
    expect(ticks).toHaveLength(5)
    expect(ticks.every((t) => t.dot && t.label === "")).toBe(true)
  })
})

describe("railJump", () => {
  const rows: ListRow[] = [header("A", 0), song(1, 0, "A"), song(2, 0, "A"), header("B", 1), song(3, 1, "B")]
  const groups: RailGroup[] = [
    { label: "A", rowIndex: 0 },
    { label: "B", rowIndex: 3 },
  ]

  it("jumps to the group header the finger is over", () => {
    expect(railJump(0, rows, groups, true)).toEqual({ index: 0, label: "A" })
    expect(railJump(0.49, rows, groups, true)).toEqual({ index: 0, label: "A" })
    expect(railJump(0.5, rows, groups, true)).toEqual({ index: 3, label: "B" })
    expect(railJump(1, rows, groups, true)).toEqual({ index: 3, label: "B" })
  })

  it("clamps the finger outside the rail", () => {
    expect(railJump(-3, rows, groups, true).index).toBe(0)
    expect(railJump(9, rows, groups, true).index).toBe(3)
  })

  it("spreads an ungrouped list over the rail and labels with the row", () => {
    const flat: ListRow[] = [song(1, 0, "3:58"), song(2, 0, "4:12"), song(3, 0, "5:01")]
    expect(railJump(0, flat, [], false)).toEqual({ index: 0, label: "3:58" })
    expect(railJump(0.5, flat, [], false)).toEqual({ index: 1, label: "4:12" })
    expect(railJump(1, flat, [], false)).toEqual({ index: 2, label: "5:01" })
  })

  it("returns an empty jump for an empty list", () => {
    expect(railJump(0.5, [], [], false)).toEqual({ index: 0, label: "" })
  })
})

describe("sample stats fixture", () => {
  it("uses the prototype lengths for PS 1 to 7 and a stable formula after", () => {
    expect(fixtureSeconds(1)).toBe(238)
    expect(fixtureSeconds(4)).toBe(305)
    expect(fixtureSeconds(100)).toBe(180 + ((100 * 53) % 170))
    expect(fixtureSeconds(100)).toBe(fixtureSeconds(100))
  })

  it("follows the prototype formulas for plays and added order", () => {
    expect(fixturePlays(3)).toBe((3 * 7919) % 1000)
    expect(fixtureAddedRank(3)).toBe(111)
  })

  it("fills only what the API left empty", () => {
    const filled = withFixtureStats(entry(3))
    expect(filled.durationSeconds).toBe(271)
    expect(filled.plays).toBe(fixturePlays(3))
    const real = withFixtureStats(entry(3, { durationSeconds: 99, plays: 5, addedRank: 7 }))
    expect(real.durationSeconds).toBe(99)
    expect(real.plays).toBe(5)
    expect(real.addedRank).toBe(7)
  })
})
