import { describe, expect, it } from "vitest"

import { resolveSearchMode } from "@/lib/searchMode"

describe("resolveSearchMode", () => {
  it("keeps song numbers and collection prompts on catalog", () => {
    expect(resolveSearchMode("274")).toBe("catalog")
    expect(resolveSearchMode("PS 1")).toBe("catalog")
    expect(resolveSearchMode("Search Prabhat Samgiita for Morning songs")).toBe("catalog")
    expect(resolveSearchMode("Morning")).toBe("catalog")
  })

  it("uses semantic for natural-language questions", () => {
    expect(resolveSearchMode("songs for peace of mind")).toBe("semantic")
    expect(resolveSearchMode("What should I sing at dawn?")).toBe("semantic")
  })
})
