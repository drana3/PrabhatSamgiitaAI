import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>()
  return {
    default: {
      getItem: vi.fn(async (key: string) => store.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        store.set(key, value)
      }),
      removeItem: vi.fn(async (key: string) => {
        store.delete(key)
      }),
      clear: vi.fn(async () => {
        store.clear()
      }),
    },
  }
})

vi.mock("@/lib/client", () => ({
  api: {
    fetchSongs: vi.fn(),
  },
}))

import AsyncStorage from "@react-native-async-storage/async-storage"
import { api } from "@/lib/client"
import { songCategories, songCollectionChips } from "@/constants/categories"
import {
  categoryCollectionPrompt,
  categoryLabel,
  isCatalogSearchQuery,
  isSongCategoryId,
  loadCategorySongs,
  mergeSongs,
  prefetchCategorySongs,
  rememberCategorySongs,
  resetCategorySongsMemory,
  resolveCategoryQuery,
  seedCategoryForQuery,
  semanticQueryForCategory,
  songNumbersForCategory,
  songsForCategoryFromCatalog,
  warmCategorySongsCache,
} from "@/lib/categorySongs"

describe("categorySongs", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    resetCategorySongsMemory()
    await AsyncStorage.clear()
  })

  it("maps mood and collection chip queries", () => {
    expect(resolveCategoryQuery("love")).toBe("love")
    expect(resolveCategoryQuery("devotion")).toBe("devotional")
    expect(resolveCategoryQuery("guru")).toBe("guru")
    expect(resolveCategoryQuery("evening")).toBe("evening")
    expect(resolveCategoryQuery("hindi")).toBe("hindi")
    expect(resolveCategoryQuery("shiva")).toBe("shiva")
    expect(resolveCategoryQuery("krishna")).toBe("krsna")
    expect(resolveCategoryQuery("bandhu he")).toBeNull()
  })

  it("seeds a theme list for feeling phrases", () => {
    expect(resolveCategoryQuery("i am feeling stressful")).toBeNull()
    expect(seedCategoryForQuery("i am feeling stressful")).toBe("peace")
    expect(seedCategoryForQuery("Guru")).toBe("guru")
    expect(seedCategoryForQuery("Hindi")).toBe("hindi")
  })

  it("puts precomputed songs first, then joins extra matches", () => {
    const primary = [{ id: "1", number: "1", title: "A" } as never]
    const extra = [
      { id: "2", number: "2", title: "B" } as never,
      { id: "1", number: "1", title: "A duplicate" } as never,
    ]
    expect(mergeSongs(primary, extra).map((row) => row.number)).toEqual(["1", "2"])
  })

  it("does not intercept catalog search queries", () => {
    expect(isCatalogSearchQuery("274")).toBe(true)
    expect(isCatalogSearchQuery("Search Prabhat Samgiita for Hindi Songs")).toBe(true)
    expect(resolveCategoryQuery("274")).toBeNull()
    expect(resolveCategoryQuery("Search Prabhat Samgiita for Hindi Songs")).toBeNull()
  })

  it("ships prepopulated numbers for mood categories and collection chips", () => {
    expect(isSongCategoryId("rain")).toBe(true)
    expect(isSongCategoryId("hindi")).toBe(true)
    expect(isSongCategoryId("jazz")).toBe(false)
    expect(categoryLabel("rain")).toBe("Rain")
    expect(categoryLabel("hindi")).toBe("Hindi")
    for (const chip of songCategories) {
      expect(songNumbersForCategory(chip.id).length).toBeGreaterThan(20)
    }
    for (const chip of songCollectionChips) {
      expect(songNumbersForCategory(chip.id).length).toBeGreaterThan(0)
    }
  })

  it("resolves Evening from bundled summaries without a catalog", () => {
    const eveningNumbers = songNumbersForCategory("evening")
    const rows = songsForCategoryFromCatalog("evening", [])
    expect(rows.length).toBe(eveningNumbers.length)
    expect(rows.map((row) => row.number)).toEqual(eveningNumbers)
    expect(rows[0]?.title).toBeTruthy()
  })

  it("does not shrink a bundled category when the live catalog is a short first page", () => {
    const eveningNumbers = songNumbersForCategory("evening")
    prefetchCategorySongs([{ number: 1, title: "First page only", is_verified: true }])
    const rows = songsForCategoryFromCatalog("evening", [{ number: 1, title: "First page only" }])
    expect(rows.length).toBe(eveningNumbers.length)
  })

  it("loads Evening without calling the live catalog", async () => {
    const result = await loadCategorySongs("evening")
    expect(api.fetchSongs).not.toHaveBeenCalled()
    expect(result.songs.length).toBeGreaterThan(20)
    expect(result.fromCache).toBe(true)
    expect(result.label).toBe("Evening")
  })

  it("loads Hindi collection songs without a live catalog", async () => {
    await warmCategorySongsCache()
    const result = await loadCategorySongs("hindi")
    expect(api.fetchSongs).not.toHaveBeenCalled()
    expect(result.songs.length).toBe(songNumbersForCategory("hindi").length)
    expect(result.label).toBe("Hindi")
  })

  it("loads Guru from the bundled list so the chip is never empty", async () => {
    const result = await loadCategorySongs("guru")
    expect(result.songs.length).toBeGreaterThan(20)
    expect(result.label).toBe("Guru")
    expect(semanticQueryForCategory("guru", "guru")).toMatch(/guru/i)
    expect(categoryCollectionPrompt("guru")).toBeNull()
    expect(categoryCollectionPrompt("hindi")).toBe("Search Prabhat Samgiita for Hindi Songs")
  })

  it("does not cache an empty category list over a prepopulated one", async () => {
    const first = await loadCategorySongs("evening")
    expect(first.songs.length).toBeGreaterThan(20)
    rememberCategorySongs("evening", [])
    const again = await loadCategorySongs("evening")
    expect(again.songs.length).toBe(first.songs.length)
  })

  it("keeps category songs first when semantic extras arrive", () => {
    const category = [
      { id: "ps-88", number: 88, title: "Evening one" },
      { id: "ps-90", number: 90, title: "Evening two" },
    ] as never[]
    const semantic = [
      { id: "ps-12", number: 12, title: "Semantic extra" },
      { id: "ps-88", number: 88, title: "Duplicate evening" },
    ] as never[]
    expect(mergeSongs(category, semantic).map((row) => row.number)).toEqual([88, 90, 12])
  })
})
