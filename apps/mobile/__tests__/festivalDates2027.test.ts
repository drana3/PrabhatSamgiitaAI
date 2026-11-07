import { describe, expect, it } from "vitest"

import {
  EXTRA_FESTIVAL_DATES,
  FESTIVAL_DATES_STILL_HIDDEN,
  FESTIVAL_DATES_TIME_ZONE,
  extraFestivalsFrom,
} from "@/data/festivalDates2027"
import { FESTIVAL_DATES_TO_CONFIRM, festivalCalendar, festivalCalendar2026 } from "@/data/festivals"

function dateOf(id: string) {
  const item = festivalCalendar.find((entry) => entry.id === id)
  return item ? `${item.year}-${String(item.month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}` : null
}

describe("festival dates 2027 and 2028 from the official Ananda Marga material", () => {
  it("is published for India time", () => {
    expect(FESTIVAL_DATES_TIME_ZONE).toBe("Asia/Kolkata")
  })

  it("carries over the observances that sit on the same civil date in the official 2024-2026 lists", () => {
    for (const year of [2027, 2028]) {
      expect(dateOf(`niilakantha-${year}`)).toBe(`${year}-02-12`)
      expect(dateOf(`dadhicii-${year}`)).toBe(`${year}-03-05`)
      expect(dateOf(`prout-day-${year}`)).toBe(`${year}-06-05`)
      expect(dateOf(`kaoshiki-${year}`)).toBe(`${year}-09-06`)
      expect(dateOf(`kiirtana-${year}`)).toBe(`${year}-10-08`)
    }
  })

  it("holds the lunar dates derived from the official fasting calendar and the Caryacarya rules", () => {
    expect(dateOf("ananda-purnima-2027")).toBe("2027-05-20")
    expect(dateOf("shravanii-2027")).toBe("2027-08-17")
    expect(dateOf("diipavalii-2027")).toBe("2027-10-29")
    expect(dateOf("vijayotsava-2027")).toBe("2027-10-09")
    expect(dateOf("ananda-purnima-2028")).toBe("2028-05-08")
    expect(dateOf("shravanii-2028")).toBe("2028-08-05")
    expect(dateOf("diipavalii-2028")).toBe("2028-10-17")
    expect(dateOf("vijayotsava-2028")).toBe("2028-09-27")
  })

  it("runs Sharadotsava on five consecutive days that end with Vijayotsava", () => {
    const ids = ["sharadotsava", "public-day", "fine-arts", "music-day", "vijayotsava"]
    for (const year of [2027, 2028]) {
      const days = ids.map((id) => {
        const item = festivalCalendar.find((entry) => entry.id === `${id}-${year}`)!
        return Date.UTC(item.year, item.month - 1, item.day) / 86400000
      })
      expect(days.map((day) => day - days[0]!)).toEqual([0, 1, 2, 3, 4])
    }
  })

  it("keeps every observance without a confirmed date hidden", () => {
    for (const { idBase } of FESTIVAL_DATES_STILL_HIDDEN) {
      expect(festivalCalendar.some((item) => item.id === `${idBase}-2027` || item.id === `${idBase}-2028`)).toBe(false)
      expect(FESTIVAL_DATES_TO_CONFIRM.map((item) => item.idBase)).toContain(idBase)
    }
  })

  it("never invents an entry: every extra date maps to a reviewed 2026 observance and a real day", () => {
    const built = extraFestivalsFrom(festivalCalendar2026)
    expect(built.length).toBe(EXTRA_FESTIVAL_DATES.length)
    for (const item of built) {
      const probe = new Date(item.year, item.month - 1, item.day)
      expect(probe.getMonth()).toBe(item.month - 1)
      expect(probe.getDate()).toBe(item.day)
    }
    expect(extraFestivalsFrom([])).toEqual([])
  })

  it("marks every computed (lunar-derived) date as expected, and no published one (QA-013)", () => {
    for (const entry of EXTRA_FESTIVAL_DATES) {
      const item = festivalCalendar.find((candidate) => candidate.id === `${entry.idBase}-${entry.year}`)!
      expect(Boolean(item.expected), item.id).toBe(entry.basis === "lunar-derived")
    }
    expect(festivalCalendar2026.some((item) => item.expected)).toBe(false)
    expect(festivalCalendar.find((item) => item.id === "ananda-purnima-2027")?.expected).toBe(true)
    expect(festivalCalendar.find((item) => item.id === "niilakantha-2027")?.expected).toBeUndefined()
  })

  it("keeps ids unique across the merged calendar", () => {
    expect(new Set(festivalCalendar.map((item) => item.id)).size).toBe(festivalCalendar.length)
  })
})
