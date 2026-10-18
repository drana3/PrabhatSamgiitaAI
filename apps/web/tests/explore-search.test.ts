import { describe, expect, it } from "vitest"

import {
  explorePrefetchEnabled,
  resolveExploreSearchKind,
  shouldPrefetchExploreSearch,
} from "@/lib/explore-search"

describe("explore search prefetch", () => {
  it("prefetches catalog lyric lookups in production", () => {
    expect(
      shouldPrefetchExploreSearch("bandhu he niye calo", "catalog", {}),
    ).toBe(true)
  })

  it("skips prefetch during Playwright runs", () => {
    expect(
      shouldPrefetchExploreSearch(
        "bandhu he niye calo",
        "catalog",
        { E2E_DISABLE_SEARCH_PREFETCH: "true" },
      ),
    ).toBe(false)
  })

  it("does not prefetch semantic searches", () => {
    expect(
      shouldPrefetchExploreSearch("songs about peace", "semantic", {}),
    ).toBe(false)
  })

  it("respects explicit explore search kind only when Feeling search is allowed", () => {
    expect(resolveExploreSearchKind("bandhu he niye calo")).toBe("catalog")
    // Guests / Feeling search off: URL kind=semantic must not force embeddings.
    expect(resolveExploreSearchKind("morning meditation", "semantic")).toBe("catalog")
    expect(resolveExploreSearchKind("unmatched theme", "semantic")).toBe("catalog")
  })

  it("treats missing env as prefetch enabled", () => {
    expect(explorePrefetchEnabled({})).toBe(true)
  })
})
