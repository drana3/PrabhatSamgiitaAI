import { describe, expect, it } from "vitest"

import {
  catalogLyricCount,
  instantExploreSongs,
  searchCatalogLyrics,
  shouldSearchCatalogLyrics,
  songsByNumbers,
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

  it("finds hamdardi when typed as humdardi", () => {
    const hits = searchCatalogLyrics("humdardi")
    expect(hits.map((hit) => hit.number)).toContain(4170)
  })

  it("finds hamdardi when a letter is missing", () => {
    const hits = searchCatalogLyrics("hamdrdi")
    expect(hits.map((hit) => hit.number)).toContain(4170)
  })

  it("interprets any remembered word locally even when suggestions would be empty", () => {
    expect(instantExploreSongs("chalo")?.map((song) => song.number)).toContain(1)
    expect(instantExploreSongs("songs of siv")?.map((song) => song.number)).toEqual(
      instantExploreSongs("shiva")?.map((song) => song.number),
    )
    expect(instantExploreSongs("hindi songs")?.length).toBeGreaterThan(0)
    expect(instantExploreSongs("guru")?.length).toBeGreaterThan(0)
    expect(instantExploreSongs("humdardi")?.map((song) => song.number)).toContain(4170)
    expect(instantExploreSongs("pandhu")?.map((song) => song.number)).toContain(1)
    expect(instantExploreSongs("bnadhu")?.map((song) => song.number)).toContain(1)
    expect(instantExploreSongs("bandhu he niye kalo")?.map((song) => song.number)).toContain(1)
    expect(instantExploreSongs("I am feeling stressful")?.length).toBeGreaterThan(0)
    expect(instantExploreSongs("zzzznotasong")).toBeNull()
  })

  it("skips suggestion lists when Feeling search is on so free text hits semantic", () => {
    const memberOn = { signedIn: true, feelingSearchEnabled: true }
    expect(instantExploreSongs("bandhu he niye calo", undefined, memberOn)).toBeNull()
    expect(instantExploreSongs("humdardi", undefined, memberOn)).toBeNull()
    expect(instantExploreSongs("I am feeling stressful", undefined, memberOn)).toBeNull()
    expect(instantExploreSongs("1", undefined, memberOn)?.[0]?.number).toBe(1)
  })

  it("matches English meaning text via the separate meaning field, not lyric body", () => {
    const query = "I can no longer bear the pain of darkness in my heart"
    const hits = searchCatalogLyrics(query)
    expect(hits[0]?.number).toBe(1)
    expect(hits[0]?.matchedBy).toBe("meaning")
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

  it("does not intercept Playwright search mocks", () => {
    const previous = process.env.NEXT_PUBLIC_E2E_DISABLE_SEARCH_PREFETCH
    process.env.NEXT_PUBLIC_E2E_DISABLE_SEARCH_PREFETCH = "true"
    expect(shouldSearchCatalogLyrics("tomar katha", "catalog")).toBe(false)
    process.env.NEXT_PUBLIC_E2E_DISABLE_SEARCH_PREFETCH = previous
  })

  it("returns local catalog songs instantly for lyrics, numbers, and festival names", () => {
    expect(instantExploreSongs("1")?.[0]?.number).toBe(1)
    expect(instantExploreSongs("diwali")?.map((song) => song.number)).toEqual([63, 64, 1637])
    expect(instantExploreSongs("siv")?.map((song) => song.number)).toEqual(
      instantExploreSongs("shiva")?.map((song) => song.number),
    )
    expect(instantExploreSongs("shiv")?.length).toBeGreaterThan(0)
    expect(instantExploreSongs("kisna")?.map((song) => song.number)).toEqual(
      instantExploreSongs("krishna")?.map((song) => song.number),
    )
    expect(instantExploreSongs("kishna")?.length).toBeGreaterThan(0)
    expect(instantExploreSongs("Search Prabhat Samgiita for Hindi Songs")?.length).toBeGreaterThan(0)
    const youth = instantExploreSongs("Search Prabhat Samgiita for Songs composed in Baba's youth")
    expect(youth?.map((song) => song.number)).toEqual([68, 209, 2526])
    expect(youth).toHaveLength(3)
    const english = instantExploreSongs("Search Prabhat Samgiita for English Songs")
    expect(english?.map((song) => song.number)).toEqual([68, 5008, 5009])
    const urdu = instantExploreSongs("Search Prabhat Samgiita for Urdu Songs")
    expect(urdu?.length).toBe(16)
  })

  it("resolves saved-song numbers from the shipped index without a network wait", () => {
    const songs = songsByNumbers([1, 5018, 99999])
    expect(songs[0]?.number).toBe(1)
    expect(songs[0]?.title).toBeTruthy()
    expect(songs[1]?.number).toBe(5018)
    expect(songs[2]).toEqual({ number: 99999, title: "Prabhat Samgiita 99999", is_verified: false })
  })
})
