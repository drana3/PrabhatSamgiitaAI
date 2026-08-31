import { publishedExploreSargamNumbers, PUBLISHED_HARMONIUM_SONG_NUMBERS } from "@prabhat/core"

import type { SongSummary } from "@/lib/api"
import payload from "../../../data/generated/complete_sargam_songs.json"

export const COMPLETE_SARGAM_QUERY = "full sargam"
export const COMPLETE_SARGAM_LABEL = "Full Sargam"

const QUERY_ALIASES = new Set([
  "full sargam",
  "complete sargam",
  "complete notation",
])

type CompleteSargamPayload = {
  songs?: SongSummary[]
  published_numbers?: number[]
}

function allCompleteSargamSongs(): SongSummary[] {
  return ((payload as CompleteSargamPayload).songs ?? []) as SongSummary[]
}

function publishedNumbers(): number[] {
  const fromJson = (payload as CompleteSargamPayload).published_numbers
  if (fromJson?.length) {
    return publishedExploreSargamNumbers(fromJson)
  }
  return publishedExploreSargamNumbers([...PUBLISHED_HARMONIUM_SONG_NUMBERS])
}

export function isCompleteSargamQuery(query: string): boolean {
  const key = query.trim().toLowerCase().replace(/\s+/g, " ")
  return QUERY_ALIASES.has(key)
}

/** Explore chip — published learner sargam (not the full RS catalog). */
export function completeSargamSongs(): SongSummary[] {
  const allowed = new Set(publishedNumbers())
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
