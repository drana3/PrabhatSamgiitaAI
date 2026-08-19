import { describe, expect, it } from "vitest"

import {
  COMPLETE_SARGAM_QUERY,
  completeSargamCount,
  completeSargamSongs,
  isCompleteSargamQuery,
} from "@/lib/complete-sargam"
import { exploreSearchKind } from "@/lib/special-collections"
import { shouldPrefetchExploreSearch } from "@/lib/explore-search"

describe("complete Sargam website list", () => {
  it("matches Explore chip queries only", () => {
    expect(isCompleteSargamQuery("Full Sargam")).toBe(true)
    expect(isCompleteSargamQuery(COMPLETE_SARGAM_QUERY)).toBe(true)
    expect(isCompleteSargamQuery("complete notation")).toBe(true)
    expect(isCompleteSargamQuery("sargam")).toBe(false)
    expect(isCompleteSargamQuery("harmonium")).toBe(false)
  })

  it("ships a non-empty complete-notation catalog", () => {
    const songs = completeSargamSongs()
    expect(songs.length).toBeGreaterThan(20)
    expect(completeSargamCount()).toBe(songs.length)
    expect(songs[0]).toMatchObject({ number: expect.any(Number), title: expect.any(String) })
  })

  it("uses catalog Explore without API prefetch", () => {
    expect(exploreSearchKind("full sargam")).toBe("catalog")
    expect(shouldPrefetchExploreSearch("full sargam", "catalog", {})).toBe(false)
  })
})
