import type { SongSummary } from "@/lib/api"
import payload from "../../../data/generated/complete_sargam_songs.json"

export const COMPLETE_SARGAM_QUERY = "full sargam"
export const COMPLETE_SARGAM_LABEL = "Full Sargam"

/** Booklet keyboard demos surfaced under Explore → Full Sargam. */
export const EXPLORE_FULL_SARGAM_NUMBERS = [1, 2, 27] as const

const QUERY_ALIASES = new Set([
  "full sargam",
  "complete sargam",
  "complete notation",
])

function allCompleteSargamSongs(): SongSummary[] {
  return (payload.songs ?? []) as SongSummary[]
}

export function isCompleteSargamQuery(query: string): boolean {
  const key = query.trim().toLowerCase().replace(/\s+/g, " ")
  return QUERY_ALIASES.has(key)
}

/** Explore chip — curated booklet songs only (not the full RS catalog). */
export function completeSargamSongs(): SongSummary[] {
  const allowed = new Set<number>(EXPLORE_FULL_SARGAM_NUMBERS)
  return allCompleteSargamSongs().filter((song) => allowed.has(song.number))
}

/** Full RS booklet catalog — notation pages and related-song rails. */
export function completeSargamCatalogSongs(): SongSummary[] {
  return allCompleteSargamSongs()
}

export function completeSargamCount(): number {
  return completeSargamSongs().length
}

export function isCompleteSargamSong(songNumber: number): boolean {
  return allCompleteSargamSongs().some((song) => song.number === songNumber)
}
