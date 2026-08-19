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
    fetchTodayRecommendations: vi.fn(),
  },
}))

import AsyncStorage from "@react-native-async-storage/async-storage"
import { api } from "@/lib/client"
import { readTodayCache, refreshTodayRecommendations } from "@/lib/todayCache"

function todayKey() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"
  const date = new Date().toLocaleDateString("en-CA", { timeZone: timezone })
  return `prabhat-today-v1:${timezone}:${date}`
}

describe("todayCache", () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
    vi.mocked(api.fetchTodayRecommendations).mockReset()
  })

  it("returns cached today context quietly when live refresh is null", async () => {
    const cached = {
      context: { recommendation_mode: "daily_reflection" },
      signals: [{ title: "Cached headline", category: "news", keywords: [] }],
      recommendations: [{ number: 1, title: "Song 1", first_line: "Line", reasons: [] }],
      disclaimer: "",
    }

    await AsyncStorage.setItem(todayKey(), JSON.stringify(cached))
    vi.mocked(api.fetchTodayRecommendations).mockResolvedValue(null)

    const result = await refreshTodayRecommendations()
    expect(result.fromCache).toBe(true)
    expect(result.error).toBeNull()
    expect(result.today?.signals?.[0]?.title).toBe("Cached headline")
  })

  it("returns cached today context quietly when live refresh throws", async () => {
    const cached = {
      context: { recommendation_mode: "daily_reflection" },
      signals: [{ title: "Cached headline", category: "news", keywords: [] }],
      recommendations: [{ number: 1, title: "Song 1", first_line: "Line", reasons: [] }],
      disclaimer: "",
    }

    await AsyncStorage.setItem(todayKey(), JSON.stringify(cached))
    vi.mocked(api.fetchTodayRecommendations).mockRejectedValue(new Error("offline"))

    const result = await refreshTodayRecommendations()
    expect(result.fromCache).toBe(true)
    expect(result.error).toBeNull()
    expect(result.today?.signals?.[0]?.title).toBe("Cached headline")
  })

  it("writes fresh today context to cache", async () => {
    const live = {
      context: { recommendation_mode: "daily_reflection" },
      signals: [],
      recommendations: [{ number: 2, title: "Song 2", first_line: "Line", reasons: [] }],
      disclaimer: "",
    }
    vi.mocked(api.fetchTodayRecommendations).mockResolvedValue(live)

    const result = await refreshTodayRecommendations()
    expect(result.error).toBeNull()
    expect(result.today?.recommendations?.[0]?.number).toBe(2)

    const cached = await readTodayCache()
    expect(cached?.recommendations?.[0]?.number).toBe(2)
  })

  it("keeps cache when live returns an empty shell", async () => {
    const cached = {
      context: { recommendation_mode: "daily_reflection", festival: "Ananda Purnima" },
      signals: [{ title: "Festival", category: "festival", summary: "", source_name: "", source_url: "" }],
      recommendations: [{ number: 58, title: "Song", reasons: [] }],
      disclaimer: "",
    }
    await AsyncStorage.setItem(todayKey(), JSON.stringify(cached))
    vi.mocked(api.fetchTodayRecommendations).mockResolvedValue({
      context: {},
      signals: [],
      recommendations: [],
      disclaimer: "",
    })

    const result = await refreshTodayRecommendations()
    expect(result.fromCache).toBe(true)
    expect(result.error).toBeNull()
    expect(result.today?.recommendations?.[0]?.number).toBe(58)
  })
})
