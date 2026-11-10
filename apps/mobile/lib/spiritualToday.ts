import { normalizeKind } from "@/lib/kirtan/kind"
import type { Kirtan } from "@/lib/kirtan/types"

/**
 * The spiritual-song shelves of Today (Dada, 10 November 2026: Today shows Prabhat Samgiita, spiritual songs and Kiirtans
 * side by side, not on separate tabs). Pure: the recordings and the day number come in.
 *  - "Spiritual for today": a few songs, a different handful each day, the same all day.
 *  - "Newly added": the newest of the rest, so the two shelves never repeat a song.
 * Only published recordings of the kind `spiritual_song` count; with none, no shelf shows (an honest empty page).
 */
export const SPIRITUAL_TODAY_COUNT = 3
/** The "Newly added" shelf shows only when at least this many songs are left after the daily handful. */
export const SPIRITUAL_NEW_MIN = 2
export const SPIRITUAL_NEW_LIMIT = 10

export function spiritualSongs(list: readonly Kirtan[]): Kirtan[] {
  return list
    .filter((k) => k.status === "published" && normalizeKind(k.kind) === "spiritual_song")
    .sort((a, b) => b.addedAt - a.addedAt || a.id.localeCompare(b.id))
}

/** `count` songs starting at a position that moves one step a day (`dayNumber` = days since the epoch). */
export function spiritualForToday(list: readonly Kirtan[], dayNumber: number, count = SPIRITUAL_TODAY_COUNT): Kirtan[] {
  const songs = spiritualSongs(list)
  if (songs.length === 0) return []
  const take = Math.min(count, songs.length)
  const start = ((Math.trunc(dayNumber) * take) % songs.length + songs.length) % songs.length
  return Array.from({ length: take }, (_, i) => songs[(start + i) % songs.length]!)
}

export function spiritualNewlyAdded(list: readonly Kirtan[], today: readonly Kirtan[], limit = SPIRITUAL_NEW_LIMIT): Kirtan[] {
  const shown = new Set(today.map((k) => k.id))
  const rest = spiritualSongs(list).filter((k) => !shown.has(k.id))
  return rest.length >= SPIRITUAL_NEW_MIN ? rest.slice(0, limit) : []
}
