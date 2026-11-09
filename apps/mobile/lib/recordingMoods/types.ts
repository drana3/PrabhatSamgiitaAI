/**
 * The mood of a recording, decided by people (docs/search-menu.md, section 6; API: apps/api `/api/v1/recording-moods`).
 * The uploader suggests, listeners confirm, the team can overrule. A mood is a public statement, so only a CONFIRMED one
 * feeds the Search menu; a suggested one is only ever shown as "waiting for confirmation".
 */

export type MoodStatus = "none" | "suggested" | "confirmed" | "rejected"

export type MoodState = {
  mood: string
  status: MoodStatus
  source: "uploader" | "listeners" | "team" | null
  locked: boolean
  yes: number
  no: number
  mine: "yes" | "no" | null
}

/** Why this person cannot vote right now (the page says it in a sentence). */
export type CannotVote = "sign_in" | "own" | "too_new" | "listen_first"

export type RecordingMoods = {
  recordingId: string
  moods: MoodState[]
  canVote: boolean
  cannotVoteBecause: CannotVote | null
  /** the person who added the recording may name one or two moods */
  canSuggest: boolean
  /** how many "yes" confirm a mood: when the uploader suggested it, and when nobody did */
  needed: { uploader: number; listeners: number }
}

export type VoteValue = "yes" | "no" | "clear"

/** What a screen can say about a failed call. */
export type MoodFailure = "network" | "signin" | "own_recording" | "too_new" | "listen_first" | "vote_limit" | "locked" | "not_uploader" | "too_many" | "not_found" | "failed"

export interface MoodBackend {
  /** recording id -> its confirmed moods (one small public list) */
  confirmed(): Promise<Record<string, string[]>>
  recording(id: string): Promise<RecordingMoods>
  suggest(id: string, moods: readonly string[]): Promise<void>
  vote(id: string, mood: string, value: VoteValue): Promise<void>
}
