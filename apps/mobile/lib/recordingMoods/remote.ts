import { NetworkError, RemoteError, type RemoteConfig } from "@/lib/kirtan/remote"
import { callFor } from "@/lib/recordingExtras/http"

import type { CannotVote, MoodBackend, MoodFailure, MoodState, RecordingMoods } from "./types"

/** The phone's side of the recording-mood API (apps/api `/api/v1/recording-moods`). */
const call = callFor("/api/v1/recording-moods")

type WireMood = { mood: string; status: MoodState["status"]; source?: MoodState["source"]; locked?: boolean; yes?: number; no?: number; mine?: "yes" | "no" | null }
type WirePage = {
  recording_id: string
  moods: WireMood[]
  can_vote: boolean
  cannot_vote_because?: CannotVote | null
  can_suggest: boolean
  needed: { uploader: number; listeners: number }
}

export function pageFromWire(w: WirePage): RecordingMoods {
  return {
    recordingId: w.recording_id,
    moods: w.moods.map((m) => ({ mood: m.mood, status: m.status, source: m.source ?? null, locked: Boolean(m.locked), yes: m.yes ?? 0, no: m.no ?? 0, mine: m.mine ?? null })),
    canVote: w.can_vote,
    cannotVoteBecause: w.cannot_vote_because ?? null,
    canSuggest: w.can_suggest,
    needed: w.needed,
  }
}

export function moodRemote(cfg: RemoteConfig): MoodBackend {
  return {
    confirmed: async () => {
      const body = await call<{ items: Array<{ recording_id: string; moods: string[] }> }>(cfg, "GET", "/confirmed")
      return Object.fromEntries(body.items.map((i) => [i.recording_id, i.moods]))
    },
    recording: async (id) => pageFromWire(await call<WirePage>(cfg, "GET", `/recordings/${encodeURIComponent(id)}`)),
    suggest: (id, moods) => call<void>(cfg, "PUT", `/recordings/${encodeURIComponent(id)}/suggest`, { moods: [...moods] }),
    vote: (id, mood, value) => call<void>(cfg, "PUT", `/recordings/${encodeURIComponent(id)}/votes/${encodeURIComponent(mood)}`, { vote: value }),
  }
}

const CODES: Record<string, MoodFailure> = {
  own_recording: "own_recording",
  too_new: "too_new",
  listen_first: "listen_first",
  vote_limit: "vote_limit",
  locked: "locked",
  not_uploader: "not_uploader",
  too_many: "too_many",
}

/** Any error of the API as a failure the screen has a sentence for. */
export function moodFailureFromError(error: unknown): MoodFailure {
  if (error instanceof NetworkError) return "network"
  if (error instanceof RemoteError) {
    if (error.status === 401) return "signin"
    if (error.status === 404) return "not_found"
    if (error.status === 429) return "vote_limit"
    return (error.code && CODES[error.code]) || "failed"
  }
  return "failed"
}
