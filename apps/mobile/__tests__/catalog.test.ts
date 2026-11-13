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
import { loadCatalog, pageSongs, readCatalogCache, resetCatalogMemory } from "@/lib/catalog"
import { catalogEntries, ensureCatalog, resetCatalogStore, useCatalogStore } from "@/lib/catalogStore"

describe("catalog cache helpers", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await AsyncStorage.clear()
    resetCatalogMemory()
    resetCatalogStore()
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

  it("falls back to cache quietly when live catalog is empty", async () => {
    await AsyncStorage.setItem(
      "prabhat-catalog-songs-v1",
      JSON.stringify([{ number: 8, title: "Cached", is_verified: false }]),
    )
    vi.mocked(api.fetchSongs).mockResolvedValue([])
    const result = await loadCatalog()
    expect(result.fromCache).toBe(true)
    expect(result.songs[0]?.number).toBe(8)
    expect(result.error).toBeNull()
  })

  it("surfaces a clear error when live and cache are both empty", async () => {
    vi.mocked(api.fetchSongs).mockResolvedValue([])
    const result = await loadCatalog()
    expect(result.songs).toEqual([])
    expect(result.error).toMatch(/Could not load the song catalog/)
  })

  it("shares one request between screens and reuses a fresh result", async () => {
    vi.mocked(api.fetchSongs).mockResolvedValue([{ number: 1, title: "A", is_verified: true }] as never)
    const [a, b] = await Promise.all([loadCatalog(), loadCatalog()])
    expect(api.fetchSongs).toHaveBeenCalledTimes(1)
    expect(a.songs).toBe(b.songs)
    await loadCatalog()
    expect(api.fetchSongs).toHaveBeenCalledTimes(1)
    await loadCatalog({ force: true })
    expect(api.fetchSongs).toHaveBeenCalledTimes(2)
  })

  it("parses the saved copy once and serves it from memory", async () => {
    await AsyncStorage.setItem("prabhat-catalog-songs-v1", JSON.stringify([{ number: 8, title: "Cached", is_verified: false }]))
    const first = await readCatalogCache()
    const second = await readCatalogCache()
    expect(second).toBe(first)
    expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1)
  })
})

describe("shared catalog store", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await AsyncStorage.clear()
    resetCatalogMemory()
    resetCatalogStore()
  })

  it("puts the saved copy in first, then the live rows, from one request for many callers", async () => {
    await AsyncStorage.setItem("prabhat-catalog-songs-v1", JSON.stringify([{ number: 8, title: "Cached", is_verified: false }]))
    vi.mocked(api.fetchSongs).mockResolvedValue([{ number: 1, title: "Live", is_verified: true }] as never)
    await Promise.all([ensureCatalog(), ensureCatalog(), ensureCatalog()])
    expect(api.fetchSongs).toHaveBeenCalledTimes(1)
    const state = useCatalogStore.getState()
    expect(state.rows.map((r) => r.number)).toEqual([1])
    expect(state.loading).toBe(false)
    expect(state.live).toBe(true)
    await ensureCatalog()
    expect(api.fetchSongs).toHaveBeenCalledTimes(1)
  })

  it("keeps the saved rows and reports the error when nothing can load", async () => {
    vi.mocked(api.fetchSongs).mockResolvedValue([])
    await ensureCatalog()
    expect(useCatalogStore.getState().error).toMatch(/Could not load/)
    expect(useCatalogStore.getState().loading).toBe(false)
  })

  it("builds entries once per catalog array", () => {
    const rows = [{ number: 1, title: "A", is_verified: true }] as never
    expect(catalogEntries(rows)).toBe(catalogEntries(rows))
    expect(catalogEntries(rows).byNumber.get(1)?.number).toBe(1)
  })
})
