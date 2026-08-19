import type { SongSummary } from "@/lib/api"
import payload from "../../../data/generated/complete_sargam_songs.json"

export const COMPLETE_SARGAM_QUERY = "full sargam"
export const COMPLETE_SARGAM_LABEL = "Full Sargam"

const QUERY_ALIASES = new Set([
  "full sargam",
  "complete sargam",
  "complete notation",
])

export function isCompleteSargamQuery(query: string): boolean {
  const key = query.trim().toLowerCase().replace(/\s+/g, " ")
  return QUERY_ALIASES.has(key)
}

export function completeSargamSongs(): SongSummary[] {
  return (payload.songs ?? []) as SongSummary[]
}

export function completeSargamCount(): number {
  return payload.count ?? completeSargamSongs().length
}
