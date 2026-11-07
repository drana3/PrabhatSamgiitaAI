import type { RemoteRecording } from "@/lib/kirtan/remote"

/** The Top Played list: what the server counted (apps/api GET /api/v1/top-played, docs/radio-mixing.md). */

export type TopPeriod = "all" | "30d" | "7d"
export const TOP_PERIODS: readonly TopPeriod[] = ["all", "30d", "7d"]

export type TopItem = {
  rank: number
  /** "ps": a song of the catalogue; "rec": an uploaded recording */
  ref: "ps" | "rec"
  /** the recording's server id, or the song number as text */
  id: string
  kind: string
  title: string
  author: string
  plays: number
  songNumber: number | null
  recording: RemoteRecording | null
}

export type TopPage = {
  period: TopPeriod
  kinds: string[]
  items: TopItem[]
  total: number
  hasMore: boolean
  /** ISO date of the first counted day ("counting since"), or null */
  since: string | null
  /** only tracks with at least this many counted plays are listed */
  minPlays: number
}

export type TopQuery = {
  period: TopPeriod
  /** empty = every kind */
  kinds: readonly string[]
  limit: number
  offset: number
}

export interface TopPlayedApi {
  fetch(query: TopQuery, signal?: AbortSignal): Promise<TopPage>
}
