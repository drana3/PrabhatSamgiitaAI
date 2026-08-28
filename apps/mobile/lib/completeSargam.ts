import type { SongSummary } from "@prabhat/core"

import payload from "../../../data/generated/complete_sargam_songs.json"

export const COMPLETE_SARGAM_BROWSE_ID = "fullsargam"
export const COMPLETE_SARGAM_LABEL = "Full Sargam"
export const COMPLETE_SARGAM_QUERY = "full sargam"

const QUERY_ALIASES = new Set(["full sargam", "complete sargam", "complete notation", "fullsargam"])

export function isCompleteSargamQuery(query: string): boolean {
  const key = query.trim().toLowerCase().replace(/\s+/g, " ")
  return QUERY_ALIASES.has(key)
}

export function completeSargamSongs(): SongSummary[] {
  return (payload.songs ?? []) as SongSummary[]
}

export function completeSargamNumbers(): number[] {
  return completeSargamSongs()
    .map((song) => song.number)
    .filter((number) => Number.isFinite(number) && number > 0)
}

export function isCompleteSargamSong(songNumber: number): boolean {
  return completeSargamNumbers().includes(songNumber)
}
