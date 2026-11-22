import { describe, expect, it } from "vitest"

import {
  LATEST_REVIEWED_FESTIVAL_YEAR,
  festivalCalendar2027,
  getFestivalById,
  getUpcomingFestivals,
} from "./festivalObservances"

describe("festivalObservances", () => {
  it("publishes reviewed 2027 dates from the festival sheet", () => {
    expect(LATEST_REVIEWED_FESTIVAL_YEAR).toBe(2027)
    expect(getFestivalById("ananda-purnima-2027")).toMatchObject({ month: 5, day: 20 })
    expect(getFestivalById("sharadotsava-2027")).toMatchObject({ month: 10, day: 5 })
    expect(getFestivalById("diipavalii-2027")).toMatchObject({ month: 10, day: 29 })
    expect(festivalCalendar2027).toHaveLength(14)
  })

  it("lists 2027 observances after the last 2026 dates", () => {
    const upcoming = getUpcomingFestivals(new Date(2026, 11, 15), 10)
    expect(upcoming.some((item) => item.id === "new-year-2027")).toBe(true)
    expect(upcoming[0]?.year).toBeGreaterThanOrEqual(2026)
  })
})