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
      __store: store,
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
import { loadCatalog, pageSongs, readCatalogCache } from "@/lib/catalog"

describe("catalog cache helpers", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await AsyncStorage.clear()
  })

  it("pages songs without dropping earlier items", () => {
    const rows = Array.from({ length: 100 }, (_, index) => index + 1)
    expect(pageSongs(rows, 1, 40)).toHaveLength(40)
    expect(pageSongs(rows, 2, 40)).toHaveLength(80)
    expect(pageSongs(rows, 3, 40)).toHaveLength(100)
  })

  it("returns live catalog and writes cache", async () => {
    vi.mocked(api.fetchSongs).mockResolvedValue([
      { number: 1, title: "BANDHU HE NIYE CALO", is_verified: true },
    ] as never)
    const result = await loadCatalog()
    expect(result.fromCache).toBe(false)
    expect(result.error).toBeNull()
    expect(result.songs[0]?.number).toBe(1)
    const cached = await readCatalogCache()
    expect(cached?.[0]?.number).toBe(1)
  })

  it("falls back to cache with an error when live catalog is empty", async () => {
    await AsyncStorage.setItem(
      "prabhat-catalog-songs-v1",
      JSON.stringify([{ number: 8, title: "Cached", is_verified: false }]),
    )
    vi.mocked(api.fetchSongs).mockResolvedValue([])
    const result = await loadCatalog()
    expect(result.fromCache).toBe(true)
    expect(result.songs[0]?.number).toBe(8)
    expect(result.error).toMatch(/saved catalog/i)
  })

  it("surfaces a clear error when live and cache are both empty", async () => {
    vi.mocked(api.fetchSongs).mockResolvedValue([])
    const result = await loadCatalog()
    expect(result.songs).toEqual([])
    expect(result.error).toMatch(/Could not load the song catalog/)
  })
})
