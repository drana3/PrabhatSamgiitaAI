import { remoteConfig } from "@/lib/kirtan/api"
import { MOCKUP_DATA } from "@/lib/mockupMode"

import { createBroadcastReviewMock } from "./mock"
import { broadcastReviewRemote, reviewFailureFromError } from "./remote"
import type { BroadcastReviewBackend, ReviewFailure } from "./types"

/** Which server the broadcast desk talks to: the real API, or in the web preview an in-memory one. Chosen when asked, never at module load. */
let mock: BroadcastReviewBackend | null = null

/** Preview only: `?team` in the address makes the previewing member count as the team (the same switch as the other desks). Once seen it sticks for the page's life. */
let teamSeen = false
function previewTeam(): boolean {
  if (teamSeen) return true
  try {
    teamSeen = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("team")
  } catch {
    teamSeen = false
  }
  return teamSeen
}

export function broadcastReviewBackend(): BroadcastReviewBackend {
  if (MOCKUP_DATA) {
    mock ??= createBroadcastReviewMock({ team: previewTeam })
    return mock
  }
  return broadcastReviewRemote(remoteConfig())
}

export function broadcastReviewFailure(error: unknown): ReviewFailure {
  return reviewFailureFromError(error)
}
