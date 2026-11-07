import { describe, expect, it } from "vitest"
import type { TodayRecommendations } from "@prabhat/core"

import { buildTodayDay, formatDayLine, formatDayLineShort, resumeLine, searchHref, TODAY_QUICK_SEARCHES } from "@/lib/todayDay"

const day = new Date(2026, 10, 1) // Sunday 1 November 2026

const withContext = (context: Record<string, unknown>) => ({ context }) as unknown as TodayRecommendations

describe("formatDayLine", () => {
  it("prints weekday and date", () => {
    expect(formatDayLine(day)).toBe("Sunday · 1 November")
  })

  it("has a short form for a narrow phone", () => {
    expect(formatDayLineShort(day)).toBe("Sun · 1 November")
  })
})

describe("buildTodayDay", () => {
  it("is an ordinary day without context", () => {
    const result = buildTodayDay(null, day)
    expect(result.kind).toBe("date")
    expect(result.kindLabel).toBe("Composed on this day")
    expect(result.tag).toBe("Song of the day")
    expect(result.alsoLabel).toBeNull()
    expect(result.note).toBe("")
  })

  it("a festival wins and names itself", () => {
    const result = buildTodayDay(withContext({ festival: "Díipávalii", season: "Hemanta", recommendation_mode: "season" }), day)
    expect(result.kind).toBe("fest")
    expect(result.kindLabel).toBe("Festival today · Díipávalii")
    expect(result.tag).toBe("For Díipávalii")
    expect(result.alsoLabel).toBe("Also composed on 1 November")
  })

  it("strict festival mode counts even without a name", () => {
    expect(buildTodayDay(withContext({ recommendation_mode: "strict_festival" }), day).kindLabel).toBe("Festival today · Festival")
  })

  it("season shows only when the API says the picks are seasonal", () => {
    expect(buildTodayDay(withContext({ season: "Hemanta", recommendation_mode: "season" }), day).kind).toBe("season")
    expect(buildTodayDay(withContext({ season: "Hemanta", recommendation_mode: "date" }), day).kind).toBe("date")
  })
})

describe("resumeLine", () => {
  it("shows position and length", () => {
    expect(resumeLine({ number: 6, position: 72, duration: 300 })).toBe("PS 6 · 1:12 of 5:00")
  })
  it("falls back to the number when the length is unknown", () => {
    expect(resumeLine({ number: 6, position: 0, duration: 0 })).toBe("PS 6")
    expect(resumeLine({ number: 6, position: 5, duration: 0 })).toBe("PS 6")
  })
})

describe("searchHref", () => {
  it("encodes the query", () => {
    expect(searchHref("peaceful devotion")).toBe("/search-v2?q=peaceful%20devotion")
  })
  it("has the three prototype quick searches", () => {
    expect(TODAY_QUICK_SEARCHES.map((q) => q.id)).toEqual(["number", "words", "feeling"])
  })
})
