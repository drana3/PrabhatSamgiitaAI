import { describe, expect, it } from "vitest"

import { resolveSearchMode, searchResultsTitle } from "@/lib/searchMode"

describe("resolveSearchMode", () => {
  it("keeps song numbers, collections, and lyric lookups on catalog", () => {
    expect(resolveSearchMode("274")).toBe("catalog")
    expect(resolveSearchMode("PS 1")).toBe("catalog")
    expect(resolveSearchMode("Search Prabhat Samgiita for Morning songs")).toBe("catalog")
    expect(resolveSearchMode("Search Prabhat Samgiita for Hindi Songs")).toBe("catalog")
    expect(resolveSearchMode("bandhu he niye calo")).toBe("catalog")
    expect(
      resolveSearchMode("alor oi jharana dharara pane andharer vyatha ar saye na prane"),
    ).toBe("catalog")
  })

  it("uses local lists for mood and collection chip words", () => {
    expect(resolveSearchMode("Devotional")).toBe("catalog")
    expect(resolveSearchMode("guru")).toBe("catalog")
    expect(resolveSearchMode("evening")).toBe("catalog")
    expect(resolveSearchMode("Hindi")).toBe("catalog")
    expect(resolveSearchMode("rain")).toBe("catalog")
    expect(resolveSearchMode("love")).toBe("catalog")
  })

  it("uses semantic for natural-language questions", () => {
    expect(resolveSearchMode("songs for peace of mind")).toBe("semantic")
    expect(resolveSearchMode("song about rain in monsoons")).toBe("semantic")
    expect(resolveSearchMode("morning meditation")).toBe("semantic")
    expect(resolveSearchMode("i am feeling stressful")).toBe("semantic")
    expect(resolveSearchMode("What should I sing at dawn?")).toBe("semantic")
    expect(resolveSearchMode("help me find guru songs")).toBe("semantic")
  })
})

describe("searchResultsTitle", () => {
  it("shows a quiet count without searching status copy", () => {
    expect(searchResultsTitle("Evening", 0)).toBe("Evening")
    expect(searchResultsTitle("Evening", 41)).toBe("Evening · 41")
    expect(searchResultsTitle(null, 0)).toBe("Songs")
    expect(searchResultsTitle(null, 12)).toBe("Songs · 12")
    expect(searchResultsTitle("Evening", 41)).not.toMatch(/searching|matching|catalog/i)
  })
})
