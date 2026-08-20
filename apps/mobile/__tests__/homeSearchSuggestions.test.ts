import { describe, expect, it, vi } from "vitest"

vi.mock("react-native", () => ({
  Platform: { OS: "ios", select: (map: Record<string, unknown>) => map.ios },
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
}))

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
    searchSongs: vi.fn(),
  },
}))

import { homeSearchSuggestions } from "@/lib/homeSearchSuggestions"

describe("home search suggestions", () => {
  it("suggests an opening line while typing", () => {
    const songs = homeSearchSuggestions("bandhu he niye calo")
    expect(songs[0]?.number).toBe(1)
  })

  it("suggests a catalog number immediately", () => {
    const songs = homeSearchSuggestions("1")
    expect(songs).toHaveLength(1)
    expect(songs[0]?.number).toBe(1)
  })

  it("suggests Dipavali songs for diwali", () => {
    expect(homeSearchSuggestions("diwali").map((song) => song.number)).toEqual([63, 64, 1637])
  })

  it("stays empty until there is a query", () => {
    expect(homeSearchSuggestions("")).toEqual([])
    expect(homeSearchSuggestions("   ")).toEqual([])
  })

  it("interprets any catalog word from the local list, not only name aliases", () => {
    expect(homeSearchSuggestions("chalo").map((song) => song.number)).toContain(1)
    expect(homeSearchSuggestions("humdardi")[0]?.number).toBe(4170)
    expect(homeSearchSuggestions("songs of siv").length).toBeGreaterThan(0)
    expect(homeSearchSuggestions("hindi").length).toBeGreaterThan(0)
  })

  it("suggests a local mood list for feeling sentences", () => {
    expect(homeSearchSuggestions("I am feeling stressful").length).toBeGreaterThan(0)
  })
})
