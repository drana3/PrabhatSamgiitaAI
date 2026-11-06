import { festivalCalendar, getUpcomingFestivals, type FestivalListItem } from "@/data/festivals"
import { songsForFestival, type FestivalSongLink, type FestivalSongs } from "@/data/festivalSongs"

/**
 * The day before a festival, and the festival's own day, by the date on the phone (its local calendar day,
 * not a 24-hour count: at 00:05 the festival of the next day is already "tomorrow").
 */
export type FestivalPhase = "today" | "tomorrow"

export function festivalPhase(daysUntil: number): FestivalPhase | null {
  return daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : null
}

/** Whole local days from `now`'s calendar day to the festival's civil date (0 today, 1 tomorrow, negative once past). */
export function daysUntilFestival(now: Date, festival: { month: number; day: number; year: number }): number {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const target = new Date(festival.year, festival.month - 1, festival.day).getTime()
  return Math.round((target - start) / 86_400_000)
}

export type EveFestival = FestivalListItem & { phase: FestivalPhase; songs: FestivalSongs }

/**
 * Festivals that are today or tomorrow and have songs to show, today's first. A festival with no song link
 * of any kind is not in the list: nothing extra is shown for it.
 */
export function eveFestivals(now: Date): EveFestival[] {
  const out: EveFestival[] = []
  for (const item of getUpcomingFestivals(now, festivalCalendar.length)) {
    const phase = festivalPhase(item.daysUntil)
    if (!phase) continue
    const songs = songsForFestival(item)
    if (songs.all.length === 0) continue
    out.push({ ...item, phase, songs })
  }
  return out
}

/**
 * The short list for Today: the festival's own list first, then the songs composed on the day, at most
 * `limit` rows. Songs of the list are never pushed out by composed songs.
 */
export function previewSongs(songs: FestivalSongs, limit = 3): FestivalSongLink[] {
  return songs.all.slice(0, Math.max(0, limit))
}
