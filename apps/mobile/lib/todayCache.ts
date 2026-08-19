import AsyncStorage from "@react-native-async-storage/async-storage"
import type { TodayRecommendations } from "@prabhat/core"

import { api } from "@/lib/client"

const CACHE_PREFIX = "prabhat-today-v1"

function cacheKey() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"
  const date = new Date().toLocaleDateString("en-CA", { timeZone: timezone })
  return `${CACHE_PREFIX}:${timezone}:${date}`
}

/** True when the payload is worth showing on Home (songs and/or context). */
export function hasUsableToday(value: TodayRecommendations | null | undefined): value is TodayRecommendations {
  if (!value) return false
  return Boolean(
    (value.recommendations?.length ?? 0) > 0 ||
      (value.signals?.length ?? 0) > 0 ||
      value.context?.festival ||
      value.context?.observance ||
      value.context?.humanitarian_context,
  )
}

export async function readTodayCache(): Promise<TodayRecommendations | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey())
    if (!raw) return null
    const parsed = JSON.parse(raw) as TodayRecommendations
    return hasUsableToday(parsed) ? parsed : null
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

/**
 * Load today’s context for Home.
 * Prefer live API; if live is empty/fails, serve cache quietly (no scary banner).
 * Does not require a website or API redeploy — mobile client only.
 */
export async function refreshTodayRecommendations(): Promise<TodayLoadResult> {
  try {
    const live = await api.fetchTodayRecommendations()
    if (hasUsableToday(live)) {
      void writeTodayCache(live)
      return { today: live, fromCache: false, error: null }
    }

    const cached = await readTodayCache()
    if (cached) {
      return { today: cached, fromCache: true, error: null }
    }

    return { today: live ?? null, fromCache: false, error: null }
  } catch {
    const cached = await readTodayCache()
    if (cached) {
      return { today: cached, fromCache: true, error: null }
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
