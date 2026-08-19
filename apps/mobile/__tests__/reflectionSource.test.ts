import { describe, expect, it } from "vitest"

import {
  fallbackReflection,
  formatReflectionQuote,
  reflectionBookCitation,
  reflectionSourceLabel,
} from "@/data/homeContent"

describe("daily reflection book citation", () => {
  it("uses a book of Shrii Shrii Anandamurti ji as fallback — not a web article", () => {
    const reflection = fallbackReflection(new Date("2026-08-08T12:00:00+05:30"))
    expect(reflection.attribution).toMatch(/Anandamurti/i)
    expect(reflection.source_title).toMatch(
      /Ánanda Sútram|Ananda Sutram|Ánanda Vacanámrtam|Caryácarya|Prout in a Nutshell/i,
    )
    expect(reflection.source_date).toMatch(/Chapter|Sútra|Sutra|Part/i)
    expect(reflection.source_url).not.toMatch(/anandamarga\.org\/articles/i)
  })

  it("rotates the fallback quote by date instead of always using Sútra 3", () => {
    const aug8 = fallbackReflection(new Date("2026-08-08T12:00:00+05:30"))
    const aug9 = fallbackReflection(new Date("2026-08-09T12:00:00+05:30"))
    expect(aug8.quote_text).not.toBe(aug9.quote_text)
    expect(aug8.quote_text).not.toBe("Infinite happiness is ánanda (bliss).")
  })

  it("formats exact book · locator citation", () => {
    const reflection = fallbackReflection(new Date("2026-08-08T12:00:00+05:30"))
    expect(reflectionBookCitation(reflection)).toBe(
      `${reflection.source_title} · ${reflection.source_date}`,
    )
    expect(reflectionSourceLabel(reflection)).toBe(
      `Source: ${reflection.source_title} · ${reflection.source_date}`,
    )
  })

  it("omits the locator when date is absent", () => {
    expect(
      reflectionBookCitation({
        ...fallbackReflection(new Date("2026-08-08T12:00:00+05:30")),
        source_date: null,
      }),
    ).toBe("Ánanda Sútram")
  })

  it("collapses line breaks so the quote can wrap as a paragraph", () => {
    expect(formatReflectionQuote("Brahma is\nthe composite\nof Shiva")).toBe(
      "Brahma is the composite of Shiva",
    )
  })
})
