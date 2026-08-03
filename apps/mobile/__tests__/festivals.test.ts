import { describe, expect, it } from "vitest"

import {
  REVIEWED_FESTIVAL_YEAR,
  festivalCalendar2026,
  festivalCalendarExhausted,
  getFestivalById,
  getUpcomingFestivals,
} from "@/data/festivals"

describe("festival calendar", () => {
  it("matches the reviewed website year and includes core observances", () => {
    expect(REVIEWED_FESTIVAL_YEAR).toBe(2026)
    expect(festivalCalendar2026.length).toBeGreaterThanOrEqual(15)
    expect(getFestivalById("ananda-purnima-2026")?.relatedCollectionLabel).toBe("Bábá Birthday Songs")
  })

  it("returns upcoming festivals after a mid-year date", () => {
    const upcoming = getUpcomingFestivals(new Date(2026, 7, 3), 5)
    expect(upcoming.length).toBeGreaterThan(0)
    expect(upcoming[0]?.daysUntil).toBeGreaterThanOrEqual(0)
    expect(upcoming.every((item, index, list) => index === 0 || item.daysUntil >= list[index - 1]!.daysUntil)).toBe(
      true,
    )
  })

  it("reports exhaustion after the reviewed year ends", () => {
    expect(festivalCalendarExhausted(new Date(2026, 11, 31))).toBe(true)
    expect(festivalCalendarExhausted(new Date(2026, 7, 3))).toBe(false)
  })
})
