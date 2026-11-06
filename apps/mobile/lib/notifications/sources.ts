import AsyncStorage from "@react-native-async-storage/async-storage"
import type { SongSummary } from "@prabhat/core"

import { festivalCalendar } from "@/data/festivals"
import { dateKey, type FestivalEntry, type SongPick, type TodaySong } from "@/lib/notifications/schedule"
import { readTodayCache } from "@/lib/todayCache"

/** The festival calendar the app already has (data/festivals.ts), in the scheduler's shape. */
export const FESTIVAL_ENTRIES: readonly FestivalEntry[] = festivalCalendar.map((f) => ({
  id: f.id,
  title: f.title,
  month: f.month,
  day: f.day,
  year: f.year,
}))

const CATALOG_CACHE_KEY = "prabhat-catalog-songs-v1"

/**
 * Songs the scheduler can pick for "Song of the day", read from the catalog the phone has already
 * saved (lib/catalog.ts). Empty when the catalog was never loaded: the notification is then the plain
 * "Open today's song." TODO(api): composed-on-this-day dates (SongPick.composed) come from the backend.
 */
export async function readSongPicks(): Promise<SongPick[]> {
  try {
    const raw = await AsyncStorage.getItem(CATALOG_CACHE_KEY)
    const parsed = raw ? (JSON.parse(raw) as SongSummary[]) : []
    return Array.isArray(parsed)
      ? parsed
          .filter((s) => typeof s?.number === "number" && typeof s?.title === "string" && s.title.trim())
          .map((s) => ({ number: s.number, title: s.title.trim() }))
      : []
  } catch {
    return []
  }
}

/**
 * The song Today shows as the song of the day: the first recommendation of the server's answer that the
 * phone saved for today (lib/todayCache.ts, the same copy the Today screen paints from). Null when Today has
 * not been loaded yet today: the reminder then says "Open today's song." instead of naming another song.
 */
export async function readTodaySong(now: number = Date.now()): Promise<TodaySong | null> {
  try {
    const today = await readTodayCache()
    const first = today?.recommendations?.[0]
    if (!first || typeof first.number !== "number" || !first.title?.trim()) return null
    return { date: dateKey(now), song: { number: first.number, title: first.title.trim() } }
  } catch {
    return null
  }
}
