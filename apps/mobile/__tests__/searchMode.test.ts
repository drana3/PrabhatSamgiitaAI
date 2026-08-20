import { describe, expect, it } from "vitest"

import {
  feelingBrowseId,
  resolveSearchMode,
  searchDebounceMs,
  searchResultsTitle,
} from "@/lib/searchMode"

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
    expect(resolveSearchMode("siv")).toBe("catalog")
    expect(resolveSearchMode("shiv")).toBe("catalog")
    expect(resolveSearchMode("shiva")).toBe("catalog")
    expect(resolveSearchMode("kisna")).toBe("catalog")
    expect(resolveSearchMode("kishna")).toBe("catalog")
    expect(resolveSearchMode("krishna")).toBe("catalog")
  })

  it("sends free text to embeddings when Feeling search is enabled for a signed-in member", () => {
    expect(resolveSearchMode("songs for peace of mind")).toBe("catalog")
    expect(resolveSearchMode("song about rain in monsoons")).toBe("catalog")
    expect(resolveSearchMode("morning meditation")).toBe("catalog")
    expect(resolveSearchMode("i am feeling stressful")).toBe("catalog")
    expect(resolveSearchMode("What should I sing at dawn?")).toBe("catalog")
    const memberOn = { signedIn: true, feelingSearchEnabled: true }
    expect(resolveSearchMode("I am feeling very stressful today", memberOn)).toBe("semantic")
    expect(resolveSearchMode("songs about peace", memberOn)).toBe("semantic")
    expect(resolveSearchMode("humdardi", memberOn)).toBe("semantic")
    expect(resolveSearchMode("274", memberOn)).toBe("catalog")
  })

  it("maps feeling sentences to a local mood list", () => {
    expect(feelingBrowseId("I am feeling very stressful today")).toBe("peace")
    expect(feelingBrowseId("help me find guru songs")).toBe("guru")
    expect(feelingBrowseId("diwali")).toBeNull()
    expect(searchDebounceMs("I am feeling very stressful today")).toBe(50)
    expect(
      searchDebounceMs("I am feeling very stressful today", {
        signedIn: true,
        feelingSearchEnabled: true,
      }),
    ).toBe(400)
    expect(searchDebounceMs("bandhu he")).toBe(50)
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
