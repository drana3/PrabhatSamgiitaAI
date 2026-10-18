/** Catalog size of Prabhat Samgiita. PS 1 through PS 5018, then back to PS 1. */
export const SONG_CATALOG_SIZE = 5018

const EPOCH_UTC = Date.UTC(1970, 0, 1)
const DAY_MS = 86_400_000

/**
 * Deterministic song number for a civil calendar date.
 * Pass the year, month, and day in the app timezone (Asia/Kolkata).
 * 1970-01-01 is PS 1. The same date always returns the same number.
 */
export function sequentialSongOfTheDay(year: number, month: number, day: number): number {
  const days = Math.floor((Date.UTC(year, month - 1, day) - EPOCH_UTC) / DAY_MS)
  const mod = ((days % SONG_CATALOG_SIZE) + SONG_CATALOG_SIZE) % SONG_CATALOG_SIZE
  return mod + 1
}
