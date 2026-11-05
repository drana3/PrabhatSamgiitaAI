import { describe, expect, it } from "vitest"

import { SEARCH_BROWSE_ALL } from "@/lib/fixtures/home"
import { browseAllTiles } from "@/lib/searchBrowse"

describe("Search browse tiles", () => {
  it("shows every prototype tile in the demo preview", () => {
    expect(browseAllTiles(SEARCH_BROWSE_ALL, true)).toHaveLength(SEARCH_BROWSE_ALL.length)
  })

  it("keeps only real categories in a real build", () => {
    const ids = browseAllTiles(SEARCH_BROWSE_ALL, false).map((t) => t.id)
    expect(ids).toEqual(["moods", "festivals", "languages", "stories"])
    for (const fake of ["made", "new", "played", "ragas", "themes", "instruments"]) expect(ids).not.toContain(fake)
  })

  it("is the real list by default (tests run without the demo flag)", () => {
    expect(browseAllTiles(SEARCH_BROWSE_ALL).length).toBeLessThan(SEARCH_BROWSE_ALL.length)
  })
})
