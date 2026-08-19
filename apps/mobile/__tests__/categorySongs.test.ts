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
import {
  categoryLabel,
  isCatalogSearchQuery,
  isSongCategoryId,
  loadCategorySongs,
  resetCategorySongsMemory,
  resolveCategoryQuery,
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

  it("maps love / devotion style queries onto precomputed categories", () => {
    expect(resolveCategoryQuery("love")).toBe("love")
    expect(resolveCategoryQuery("Love")).toBe("love")
    expect(resolveCategoryQuery("devotion")).toBe("devotional")
    expect(resolveCategoryQuery("Devotional")).toBe("devotional")
    expect(resolveCategoryQuery("bhakti")).toBe("devotional")
    expect(resolveCategoryQuery("bhajan")).toBe("devotional")
    expect(resolveCategoryQuery("kirtan")).toBe("devotional")
    expect(resolveCategoryQuery("prayer")).toBe("devotional")
    expect(resolveCategoryQuery("worship")).toBe("devotional")
    expect(resolveCategoryQuery("spiritual")).toBe("devotional")
    expect(resolveCategoryQuery("songs of devotion")).toBe("devotional")
    expect(resolveCategoryQuery("devotional songs")).toBe("devotional")
    expect(resolveCategoryQuery("song about rain")).toBe("rain")
    expect(resolveCategoryQuery("rain")).toBe("rain")
    expect(resolveCategoryQuery("peaceful")).toBe("peace")
    expect(resolveCategoryQuery("bandhu he")).toBeNull()
  })

  it("does not intercept catalog search queries", () => {
    expect(isCatalogSearchQuery("274")).toBe(true)
    expect(isCatalogSearchQuery("Search Prabhat Samgiita for Hindi Songs")).toBe(true)
    expect(resolveCategoryQuery("274")).toBeNull()
    expect(resolveCategoryQuery("Search Prabhat Samgiita for Hindi Songs")).toBeNull()
    expect(resolveCategoryQuery("Search Prabhat Samgiita for Morning songs")).toBeNull()
    // Languages / named collections stay on catalog search
    expect(resolveCategoryQuery("hindi")).toBeNull()
    expect(resolveCategoryQuery("shiva")).toBeNull()
    expect(resolveCategoryQuery("spring")).toBeNull()
  })

  it("ships precalculated song numbers for every Songs-tab category", () => {
    expect(isSongCategoryId("rain")).toBe(true)
    expect(isSongCategoryId("jazz")).toBe(false)
    expect(isSongCategoryId("hindi")).toBe(false)
    expect(categoryLabel("rain")).toBe("Rain")
    for (const id of [
      "devotional",
      "nature",
      "love",
      "meditation",
      "morning",
      "evening",
      "rain",
      "festival",
      "guru",
      "peace",
    ] as const) {
      expect(songNumbersForCategory(id).length).toBeGreaterThan(20)
    }
  })

  it("resolves category songs from a local catalog without network", () => {
    const rainNumbers = songNumbersForCategory("rain")
    const catalog = rainNumbers.map((number) => ({
      number,
      title: `Song ${number}`,
      is_verified: true,
    }))
    const rows = songsForCategoryFromCatalog("rain", catalog as never)
    expect(rows).toHaveLength(rainNumbers.length)
    expect(rows.map((row) => row.number)).toEqual(rainNumbers)
  })

  it("loads category songs from catalog cache without calling search", async () => {
    const rainNumbers = songNumbersForCategory("rain")
    await AsyncStorage.setItem(
      "prabhat-catalog-songs-v1",
      JSON.stringify(
        rainNumbers.map((number) => ({ number, title: `Song ${number}`, is_verified: true })),
      ),
    )
    await warmCategorySongsCache()
    const result = await loadCategorySongs("rain")
    expect(api.fetchSongs).not.toHaveBeenCalled()
    expect(result.songs.length).toBe(rainNumbers.length)
    expect(result.fromCache).toBe(true)
    expect(result.label).toBe("Rain")
  })
})
