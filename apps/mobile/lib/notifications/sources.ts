import AsyncStorage from "@react-native-async-storage/async-storage"
import type { SongSummary } from "@prabhat/core"

import { festivalCalendar } from "@/data/festivals"
import type { FestivalEntry, SongPick } from "@/lib/notifications/schedule"

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
