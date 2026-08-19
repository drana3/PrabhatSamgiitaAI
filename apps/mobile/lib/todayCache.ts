import AsyncStorage from "@react-native-async-storage/async-storage"
import type { TodayRecommendations } from "@prabhat/core"

import { api } from "@/lib/client"

const CACHE_PREFIX = "prabhat-today-v1"

function cacheKey() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"
  const date = new Date().toLocaleDateString("en-CA", { timeZone: timezone })
  return `${CACHE_PREFIX}:${timezone}:${date}`
}

export async function readTodayCache(): Promise<TodayRecommendations | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey())
    if (!raw) return null
    return JSON.parse(raw) as TodayRecommendations
  } catch {
    return null
  }
}

async function writeTodayCache(value: TodayRecommendations) {
  try {
    await AsyncStorage.setItem(cacheKey(), JSON.stringify(value))
  } catch {
    /* ignore quota / storage failures */
  }
}

export type TodayLoadResult = {
  today: TodayRecommendations | null
  fromCache: boolean
  error: string | null
}

export async function refreshTodayRecommendations(): Promise<TodayLoadResult> {
  try {
    const live = await api.fetchTodayRecommendations()
    if (live) {
      void writeTodayCache(live)
      return { today: live, fromCache: false, error: null }
    }
    const cached = await readTodayCache()
    if (cached) {
      return {
        today: cached,
        fromCache: true,
        error: "Showing saved today’s context — live refresh returned empty.",
      }
    }
    return { today: null, fromCache: false, error: null }
  } catch {
    const cached = await readTodayCache()
    if (cached) {
      return {
        today: cached,
        fromCache: true,
        error: "Showing saved today’s context — live refresh failed.",
      }
    }
    return {
      today: null,
      fromCache: false,
      error: "Could not load today’s recommendations. Check your connection.",
    }
  }
}

/** @deprecated Use readTodayCache + refreshTodayRecommendations */
export async function loadTodayRecommendations(): Promise<TodayLoadResult> {
  return refreshTodayRecommendations()
}
