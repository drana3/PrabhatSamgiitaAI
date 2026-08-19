import { describe, expect, it } from "vitest"

import {
  catalogLyricCount,
  searchCatalogLyrics,
  shouldSearchCatalogLyrics,
} from "@/lib/lyric-search"

describe("web lyric search", () => {
  it("finds an opening line in the shipped index", () => {
    const hits = searchCatalogLyrics("BANDHU HE NIYE CALO")
    expect(hits[0]?.number).toBe(1)
    expect(hits[0]?.matchedBy).toBe("opening_line")
  })

  it("finds a line from inside the song", () => {
    const hits = searchCatalogLyrics("ANDHARER VYATHA AR SAYE NA PRANE")
    expect(hits.map((hit) => hit.number)).toContain(1)
  })

  it("does not match English meaning translations", () => {
    const hits = searchCatalogLyrics("I can no longer bear the pain of darkness in my heart")
    expect(hits.map((hit) => hit.number)).not.toContain(1)
  })

  it("indexes all 5018 songs and finds a late-catalog verse", () => {
    expect(catalogLyricCount()).toBe(5018)
    const hits = searchCatalogLyrics("JINANER ALOKE RAUNGIYE DOBO")
    expect(hits.map((hit) => hit.number)).toContain(5018)
  })

  it("searches long lyric lines even when Explore would otherwise use semantic mode", () => {
    expect(
      shouldSearchCatalogLyrics(
        "alor oi jharana dharara pane andharer vyatha ar saye na prane",
        "semantic",
      ),
    ).toBe(true)
  })

  it("skips local search for numbers, collections, and theme chips", () => {
    expect(shouldSearchCatalogLyrics("1", "catalog")).toBe(false)
    expect(shouldSearchCatalogLyrics("Search Prabhat Samgiita for Hindi Songs", "catalog")).toBe(false)
    expect(shouldSearchCatalogLyrics("love devotion", "catalog")).toBe(false)
    expect(shouldSearchCatalogLyrics("songs about peace", "semantic")).toBe(false)
    expect(shouldSearchCatalogLyrics("bandhu he niye calo", "catalog")).toBe(true)
  })
})
