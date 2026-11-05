import { describe, expect, it } from "vitest"

import {
  FESTIVAL_CALENDAR_LAST_YEAR,
  FESTIVAL_DATES_TO_CONFIRM,
  REVIEWED_FESTIVAL_YEAR,
  festivalCalendar,
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
    expect(getFestivalById("sharadotsava-2026")).toMatchObject({ month: 10, day: 16 })
    expect(getFestivalById("vijayotsava-2026")).toMatchObject({ month: 10, day: 20 })
    expect(festivalCalendar2026.some((item) => item.month === 10 && item.day === 1)).toBe(false)
  })

  it("returns upcoming festivals after a mid-year date", () => {
    const upcoming = getUpcomingFestivals(new Date(2026, 7, 3), 5)
    expect(upcoming.length).toBeGreaterThan(0)
    expect(upcoming[0]?.daysUntil).toBeGreaterThanOrEqual(0)
    expect(upcoming.every((item, index, list) => index === 0 || item.daysUntil >= list[index - 1]!.daysUntil)).toBe(
      true,
    )
  })

  it("reports exhaustion only after the last listed date", () => {
    expect(FESTIVAL_CALENDAR_LAST_YEAR).toBe(2028)
    expect(festivalCalendarExhausted(new Date(2026, 11, 31))).toBe(false)
    expect(festivalCalendarExhausted(new Date(2028, 11, 31))).toBe(true)
    expect(festivalCalendarExhausted(new Date(2026, 7, 3))).toBe(false)
  })

  it("lists 2027 and 2028 only for observances held on the same civil date every year", () => {
    const later = festivalCalendar.filter((item) => item.year > REVIEWED_FESTIVAL_YEAR)
    expect(later.map((item) => `${item.year}-${item.month}-${item.day}`).sort()).toEqual([
      "2027-1-25",
      "2027-5-21",
      "2027-9-14",
      "2028-1-25",
      "2028-5-21",
      "2028-9-14",
    ])
    // none of the lunar or festival dates is guessed
    expect(later.some((item) => /diipavalii|vijayotsava|vasantotsava|purnima/.test(item.id))).toBe(false)
    expect(festivalCalendar.every((item) => item.year <= FESTIVAL_CALENDAR_LAST_YEAR)).toBe(true)
  })

  it("keeps ids unique and names every observance that still needs a date", () => {
    expect(new Set(festivalCalendar.map((item) => item.id)).size).toBe(festivalCalendar.length)
    const pending = FESTIVAL_DATES_TO_CONFIRM.map((item) => item.idBase)
    expect(pending).toContain("diipavalii")
    expect(pending).toContain("vijayotsava")
    expect(pending).not.toContain("ru-day")
    expect(pending).not.toContain("ps-divasa")
    // nothing pending is also in the calendar for those years
    for (const item of FESTIVAL_DATES_TO_CONFIRM) {
      expect(festivalCalendar.some((entry) => entry.id === `${item.idBase}-2027`)).toBe(false)
    }
  })

  it("still lists dates after the reviewed year ends", () => {
    const next = getUpcomingFestivals(new Date(2026, 11, 31), 3)
    expect(next[0]).toMatchObject({ id: "ru-day-2027", month: 1, day: 25, year: 2027 })
  })
})
