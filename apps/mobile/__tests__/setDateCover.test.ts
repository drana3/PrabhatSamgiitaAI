import { describe, expect, it } from "vitest"

import { COVER_MAX_BYTES, COVER_STEPS, coverSrc, shrinkCover } from "@/lib/kirtan/setCover"
import { checkEventDate, eventLabel, eventYears, firstDayOf, monthsOf, yearMonthOf } from "@/lib/kirtan/setDate"

const NOW = new Date("2026-11-07T10:00:00Z")

describe("approximate date: year and month", () => {
  it("lists this year first, down to 1900", () => {
    const years = eventYears(NOW)
    expect(years[0]).toBe(2026)
    expect(years.at(-1)).toBe(1900)
  })

  it("offers only the months that have begun in the current year", () => {
    expect(monthsOf(2026, NOW)).toHaveLength(11)
    expect(monthsOf(2025, NOW)).toHaveLength(12)
    expect(monthsOf(null, NOW)).toHaveLength(12)
  })

  it("a year is required, the month is optional, nothing may be ahead of today", () => {
    expect(checkEventDate(null, null, NOW)).toBe("year")
    expect(checkEventDate(1850, null, NOW)).toBe("year")
    expect(checkEventDate(2026, null, NOW)).toBeNull()
    expect(checkEventDate(2026, 11, NOW)).toBeNull()
    expect(checkEventDate(2026, 12, NOW)).toBe("future")
    expect(checkEventDate(2027, null, NOW)).toBe("future")
    expect(checkEventDate(2020, 13, NOW)).toBe("year")
  })

  it("files under the first of the month, or 1 January", () => {
    expect(firstDayOf(2026, 3)).toBe("2026-03-01")
    expect(firstDayOf(2026, null)).toBe("2026-01-01")
    expect(firstDayOf(null, 3)).toBe("")
    expect(yearMonthOf("2024-07-19")).toEqual({ year: 2024, month: 7 })
    expect(yearMonthOf("nonsense")).toBeNull()
  })

  it("labels as month and year, or just the year", () => {
    expect(eventLabel(2026, 3, (m) => `M${m}`)).toBe("M3 2026")
    expect(eventLabel(2026, null, (m) => `M${m}`)).toBe("2026")
    expect(eventLabel(null, 3, (m) => `M${m}`)).toBe("")
  })
})

describe("cover picture", () => {
  it("caps at 300 KB like an author photo", () => {
    expect(COVER_MAX_BYTES).toBe(300 * 1024)
  })

  it("takes the first step that fits", async () => {
    const sizes = [900_000, 400_000, 200_000]
    const widths: number[] = []
    const result = await shrinkCover(
      async (step) => {
        widths.push(step.width)
        return `file:///c${widths.length}.jpg`
      },
      async (uri) => sizes[Number(uri.match(/c(\d)/)![1]) - 1]!,
    )
    expect(result).toEqual({ status: "ok", uri: "file:///c3.jpg", bytes: 200_000 })
    expect(widths).toEqual(COVER_STEPS.slice(0, 3).map((s) => s.width))
  })

  it("gives up with tooBig when no step fits, and with error when something throws", async () => {
    expect(await shrinkCover(async () => "file:///x.jpg", async () => COVER_MAX_BYTES + 1)).toEqual({ status: "tooBig" })
    expect(await shrinkCover(async () => { throw new Error("boom") }, async () => 1)).toEqual({ status: "error" })
    expect(await shrinkCover(async () => "file:///x.jpg", async () => 0)).toEqual({ status: "tooBig" })
  })

  it("makes the API path absolute and leaves full links alone", () => {
    expect(coverSrc("/api/v1/recording-sets/s1/cover?v=ab", "https://api.test/")).toBe("https://api.test/api/v1/recording-sets/s1/cover?v=ab")
    expect(coverSrc("https://cdn.test/c.jpg", "https://api.test")).toBe("https://cdn.test/c.jpg")
    expect(coverSrc(null, "https://api.test")).toBeNull()
    expect(coverSrc("", "https://api.test")).toBeNull()
  })
})
