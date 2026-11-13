import { describe, expect, it, vi } from "vitest"

import { demoTopPage } from "@/lib/topPlayed/demo"
import { createShelfCache, loadShelfKind, SHELF_FETCH, SHELF_KINDS, SHELF_MIN, shelfQuery, shelfRows, shelfVisible } from "@/lib/topPlayed/shelf"
import type { TopItem, TopPage, TopPlayedApi } from "@/lib/topPlayed/types"
import { en } from "@/locales/en"
import { es } from "@/locales/es"
import { ru } from "@/locales/ru"

const item = (rank: number, over: Partial<TopItem> = {}): TopItem => ({
  rank,
  ref: "ps",
  id: String(rank),
  kind: "prabhat_samgiita",
  title: `Song ${rank}`,
  author: "",
  plays: 100 - rank,
  songNumber: rank,
  recording: null,
  ...over,
})
const items = (n: number) => Array.from({ length: n }, (_, i) => item(i + 1))
const pageOf = (rows: TopItem[]): TopPage => ({ period: "7d", kinds: [], items: rows, total: rows.length, hasMore: false, since: null, minPlays: 5 })

describe("Most played shelf: what it asks and when it shows", () => {
  it("asks for the last 7 days, a few more than five, one kind per chip", () => {
    expect(shelfQuery("all")).toEqual({ period: "7d", kinds: [], limit: SHELF_FETCH, offset: 0 })
    expect(shelfQuery("kiirtan").kinds).toEqual(["kiirtan"])
    expect(SHELF_FETCH).toBeGreaterThan(SHELF_MIN)
    expect(SHELF_KINDS).toEqual(["all", "prabhat_samgiita", "kiirtan", "bhajan"])
  })

  it("hides while there are fewer than five rows and shows from five", () => {
    expect(shelfVisible(undefined)).toBe(false)
    expect(shelfVisible([])).toBe(false)
    expect(shelfVisible(shelfRows(items(4)))).toBe(false)
    expect(shelfVisible(shelfRows(items(5)))).toBe(true)
  })

  it("shows five rows at most", () => {
    expect(shelfRows(items(8))).toHaveLength(5)
  })

  it("leaves out a blocked author's recording and numbers the places again", () => {
    const rows = [item(1), item(2, { ref: "rec", id: "r2", author: "Blocked Singer", recording: { author_id: "a-blocked" } as TopItem["recording"] }), item(3), item(4), item(5), item(6)]
    const shown = shelfRows(rows, ["a-blocked"])
    expect(shown.map((r) => r.id)).toEqual(["1", "3", "4", "5", "6"])
    expect(shown.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5])
  })

  it("a blocked author can drop the shelf below five: it hides", () => {
    const rows = [item(1), item(2, { ref: "rec", id: "r2", author: "Blocked Singer", recording: { author_id: "a-blocked" } as TopItem["recording"] }), item(3), item(4), item(5)]
    expect(shelfVisible(shelfRows(rows, ["a-blocked"]))).toBe(false)
  })

  it("the preview's demo list gives a full shelf for the week and every chip", () => {
    for (const kind of SHELF_KINDS) {
      const page = demoTopPage(shelfQuery(kind))
      expect(page.items.length).toBeGreaterThan(0)
    }
    expect(demoTopPage(shelfQuery("all")).items.length).toBeGreaterThanOrEqual(SHELF_MIN)
  })
})

describe("Most played shelf: the five-minute cache", () => {
  const fake = (rows: TopItem[]): TopPlayedApi & { fetch: ReturnType<typeof vi.fn> } => ({ fetch: vi.fn(async () => pageOf(rows)) })

  it("asks the server once, then answers from the cache until it is five minutes old", async () => {
    const api = fake(items(6))
    const cache = createShelfCache()
    await loadShelfKind(api, "all", cache, 1000)
    await loadShelfKind(api, "all", cache, 1000 + 4 * 60 * 1000)
    expect(api.fetch).toHaveBeenCalledTimes(1)
    await loadShelfKind(api, "all", cache, 1000 + 5 * 60 * 1000 + 1)
    expect(api.fetch).toHaveBeenCalledTimes(2)
  })

  it("keeps each kind apart", async () => {
    const api = fake(items(6))
    const cache = createShelfCache()
    await loadShelfKind(api, "all", cache, 0)
    await loadShelfKind(api, "kiirtan", cache, 0)
    expect(api.fetch).toHaveBeenCalledTimes(2)
  })

  it("does not remember a failed request", async () => {
    const api: TopPlayedApi = { fetch: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(pageOf(items(5))) }
    const cache = createShelfCache()
    await expect(loadShelfKind(api, "all", cache, 0)).rejects.toThrow()
    expect(await loadShelfKind(api, "all", cache, 1)).toHaveLength(5)
  })
})

describe("Most played shelf: the words", () => {
  const keys = ["home.mostPlayed.eyebrow", "home.mostPlayed.first", "home.mostPlayed.second", "home.mostPlayed.more", "home.mostPlayed.row.a11y"] as const
  it("exist in en, ru and es", () => {
    for (const dict of [en, ru, es] as Record<string, string>[]) for (const k of keys) expect(dict[k], k).toBeTruthy()
  })
  it("the row label carries the place and the title but no play count", () => {
    expect(en["home.mostPlayed.row.a11y"]).toContain("{rank}")
    expect(en["home.mostPlayed.row.a11y"]).toContain("{title}")
    expect(en["home.mostPlayed.row.a11y"]).not.toContain("{plays}")
  })
})
