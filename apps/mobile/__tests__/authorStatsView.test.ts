import { describe, expect, it } from "vitest"

import { areaPath, linePath, MIN_ACTIVE_WEEKS, MIN_CHART_WEEKS, sparkPoints, statsMode } from "@/lib/authors/statsView"
import type { PublicStats, WeekPlays } from "@/lib/authors/types"

const weeks = (...plays: number[]): WeekPlays[] =>
  plays.map((n, i) => ({ start: `2026-09-${String(i + 1).padStart(2, "0")}`, plays: n }))

const enough = (w: WeekPlays[] | null | undefined): PublicStats => ({
  enough_data: true,
  counting_since: "2026-09-01",
  monthly_listeners: 40,
  total_plays: 120,
  weeks: w,
})

describe("statsMode: variant A, falling back to D", () => {
  it("shows nothing when the owner hid the numbers (no stats at all)", () => {
    expect(statsMode(null)).toBe("none")
    expect(statsMode(undefined)).toBe("none")
  })

  it("is quiet under the threshold, even if a series is somehow present", () => {
    const stats: PublicStats = { enough_data: false, counting_since: "2026-09-01", monthly_listeners: null, total_plays: null, weeks: weeks(1, 2, 3, 4) }
    expect(statsMode(stats)).toBe("quiet")
  })

  it("is quiet when the numbers are missing although enough_data is set", () => {
    expect(statsMode({ ...enough(weeks(5, 5, 5)), total_plays: null })).toBe("quiet")
    expect(statsMode({ ...enough(weeks(5, 5, 5)), monthly_listeners: null })).toBe("quiet")
  })

  it("draws the chart from exactly the minimum weeks with exactly the minimum active weeks", () => {
    expect(MIN_CHART_WEEKS).toBe(3)
    expect(MIN_ACTIVE_WEEKS).toBe(2)
    expect(statsMode(enough(weeks(0, 4, 6)))).toBe("chart")
  })

  it("falls back to the plain line one week short of a chart", () => {
    expect(statsMode(enough(weeks(60, 60)))).toBe("line")
  })

  it("falls back to the plain line with zero weeks, an empty series, or an older server without the field", () => {
    expect(statsMode(enough([]))).toBe("line")
    expect(statsMode(enough(null))).toBe("line")
    expect(statsMode(enough(undefined))).toBe("line")
  })

  it("falls back to the plain line when only one week has any plays", () => {
    expect(statsMode(enough(weeks(0, 0, 9)))).toBe("line")
    expect(statsMode(enough(weeks(10, 0, 0, 0)))).toBe("line")
  })

  it("draws the chart for a full twelve weeks", () => {
    expect(statsMode(enough(weeks(...Array.from({ length: 12 }, (_, i) => i + 1))))).toBe("chart")
  })
})

describe("the weekly line geometry", () => {
  it("spreads weeks evenly, zero at the bottom and the busiest week at the top", () => {
    const pts = sparkPoints(weeks(0, 50, 100), 100, 60, 6)
    expect(pts).toEqual([
      { x: 6, y: 54 },
      { x: 50, y: 30 },
      { x: 94, y: 6 },
    ])
  })

  it("keeps a single point in the middle and survives all zeros without dividing by zero", () => {
    expect(sparkPoints(weeks(7), 100, 60)).toEqual([{ x: 50, y: 6 }])
    const flat = sparkPoints(weeks(0, 0, 0), 100, 60)
    expect(flat.every((p) => p.y === 54)).toBe(true)
  })

  it("returns nothing before the width is measured", () => {
    expect(sparkPoints(weeks(1, 2, 3), 0, 60)).toEqual([])
    expect(sparkPoints([], 100, 60)).toEqual([])
  })

  it("builds a path and a closed area down to the bottom edge", () => {
    const pts = sparkPoints(weeks(0, 50, 100), 100, 60, 6)
    expect(linePath(pts)).toBe("M6 54 L50 30 L94 6")
    expect(areaPath(pts, 60)).toBe("M6 54 L50 30 L94 6 L94 60 L6 60 Z")
    expect(areaPath([], 60)).toBe("")
  })
})
