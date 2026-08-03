import { describe, expect, it } from "vitest"

import {
  fallbackReflection,
  reflectionBookCitation,
  reflectionSourceLabel,
} from "@/data/homeContent"

describe("daily reflection book citation", () => {
  it("uses a book of Shrii Shrii Anandamurti ji as fallback — not a web article", () => {
    expect(fallbackReflection.attribution).toMatch(/Anandamurti/i)
    expect(fallbackReflection.source_title).toMatch(/Ánanda Sútram|Ananda Sutram/i)
    expect(fallbackReflection.source_date).toMatch(/Chapter|Sútra|Sutra/i)
    expect(fallbackReflection.source_url).not.toMatch(/anandamarga\.org\/articles/i)
  })

  it("formats exact book · locator citation", () => {
    expect(reflectionBookCitation(fallbackReflection)).toBe(
      "Ánanda Sútram · 1961 · Chapter 2, Sútra 3",
    )
    expect(reflectionSourceLabel(fallbackReflection)).toBe(
      "Source: Ánanda Sútram · 1961 · Chapter 2, Sútra 3",
    )
  })

  it("omits the locator when date is absent", () => {
    expect(
      reflectionBookCitation({
        ...fallbackReflection,
        source_date: null,
      }),
    ).toBe("Ánanda Sútram")
  })
})
