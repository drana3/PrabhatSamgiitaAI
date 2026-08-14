import { describe, expect, it } from "vitest"

import { resolveSearchMode } from "@/lib/searchMode"

describe("resolveSearchMode", () => {
  it("keeps song numbers, collections, and lyric lookups on catalog", () => {
    expect(resolveSearchMode("274")).toBe("catalog")
    expect(resolveSearchMode("PS 1")).toBe("catalog")
    expect(resolveSearchMode("Search Prabhat Samgiita for Morning songs")).toBe("catalog")
    expect(resolveSearchMode("bandhu he niye calo")).toBe("catalog")
    expect(resolveSearchMode("What should I sing at dawn?")).toBe("catalog")
  })

  it("uses semantic for natural-language questions", () => {
    expect(resolveSearchMode("songs for peace of mind")).toBe("semantic")
    expect(resolveSearchMode("song about rain")).toBe("semantic")
    expect(resolveSearchMode("morning meditation")).toBe("semantic")
  })
})
