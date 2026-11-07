import { remoteConfig } from "@/lib/kirtan/api"
import { MOCKUP_DATA } from "@/lib/mockupMode"

import { createTeamReviewMock } from "./mock"
import { reviewFailureFromError, teamReviewRemote } from "./remote"
import type { ReviewFailure, TeamReviewBackend } from "./types"

/** Which server the review desk talks to: the real API, or in the web preview an in-memory one. Chosen when asked, never at module load. */
let mock: TeamReviewBackend | null = null

/**
 * Preview only: `?team` in the address makes the previewing member count as the team (the same switch as the chord
 * review). Once seen it sticks for the page's life, because moving between screens drops the query from the address.
 */
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

export function teamReviewBackend(): TeamReviewBackend {
  if (MOCKUP_DATA) {
    mock ??= createTeamReviewMock({ team: previewTeam })
    return mock
  }
  return teamReviewRemote(remoteConfig())
}

export function reviewFailure(error: unknown): ReviewFailure {
  return reviewFailureFromError(error)
}
