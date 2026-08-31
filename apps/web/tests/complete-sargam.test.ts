import { describe, expect, it } from "vitest"

import {
  COMPLETE_SARGAM_QUERY,
  completeSargamCount,
  completeSargamSongs,
  isCompleteSargamQuery,
  isCompleteSargamSong,
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

  it("lists curated Explore booklet songs only", () => {
    const songs = completeSargamSongs()
    expect(songs).toHaveLength(3)
    expect(completeSargamCount()).toBe(3)
    expect(songs.map((song) => song.number)).toEqual([1, 2, 27])
    expect(isCompleteSargamSong(1)).toBe(true)
    expect(isCompleteSargamSong(175)).toBe(true)
    expect(isCompleteSargamSong(176)).toBe(false)
    expect(isCompleteSargamSong(296)).toBe(false)
  })

  it("uses catalog Explore without API prefetch", () => {
    expect(exploreSearchKind("full sargam")).toBe("catalog")
    expect(shouldPrefetchExploreSearch("full sargam", "catalog", {})).toBe(false)
  })
})
