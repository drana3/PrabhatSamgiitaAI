import { describe, expect, it } from "vitest"

import {
  reflectionSeedQuotes,
  selectReflectionForDay,
  todayInKolkata,
  todayReflectionFallback,
} from "./reflections"

describe("reflection selection", () => {
  it("returns different quotes for different dates", () => {
    const first = selectReflectionForDay(reflectionSeedQuotes, new Date(2026, 7, 8))
    const second = selectReflectionForDay(reflectionSeedQuotes, new Date(2026, 7, 9))
    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(first?.quote_text).not.toBe(second?.quote_text)
  })

  it("uses the reviewed festival label on Ananda Marga festival days", () => {
    const selected = selectReflectionForDay(reflectionSeedQuotes, new Date(2026, 8, 6))
    expect(selected?.context_label).toBe("Kaoshiki Divas")
  })

  it("uses a date-based fallback for today in Kolkata", () => {
    const fallback = todayReflectionFallback(new Date("2026-08-08T00:30:00+05:30"))
    const expected = selectReflectionForDay(reflectionSeedQuotes, todayInKolkata(new Date("2026-08-08T00:30:00+05:30")))
    expect(fallback.quote_text).toBe(expected?.quote_text)
    expect(fallback.quote_text).not.toBe("Infinite happiness is ánanda (bliss).")
  })
})
