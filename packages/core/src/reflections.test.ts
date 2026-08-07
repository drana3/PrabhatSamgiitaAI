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

  it("prefers observance-tagged quotes on independence day", () => {
    const selected = selectReflectionForDay(reflectionSeedQuotes, new Date(2026, 7, 15))
    const observanceTagged = reflectionSeedQuotes.filter((quote) =>
      quote.observances.values.includes("independence-day-india"),
    )
    expect(observanceTagged.some((quote) => quote.quote_text === selected?.quote_text)).toBe(true)
    expect(selected?.context_label).toBe("India Independence Day")
  })

  it("uses a date-based fallback for today in Kolkata", () => {
    const fallback = todayReflectionFallback(new Date("2026-08-08T00:30:00+05:30"))
    const expected = selectReflectionForDay(reflectionSeedQuotes, todayInKolkata(new Date("2026-08-08T00:30:00+05:30")))
    expect(fallback.quote_text).toBe(expected?.quote_text)
    expect(fallback.quote_text).not.toBe("Infinite happiness is ánanda (bliss).")
  })
})
