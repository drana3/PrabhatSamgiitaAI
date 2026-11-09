import { createDeskDemo } from "@/lib/authors/deskDemo"
import { deskRemote } from "@/lib/authors/deskRemote"
import type { ClaimsDesk } from "@/lib/authors/desk"
import { remoteConfig } from "@/lib/kirtan/api"
import { MOCKUP_DATA } from "@/lib/mockupMode"

/**
 * Which server the team desk talks to: the real API, or in the web preview an in-memory one. Chosen when asked, never at
 * module load. Preview only: `?team` in the address makes the previewing member count as the team (the review desk's switch).
 */
let demo: ClaimsDesk | null = null
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

export function claimsDesk(): ClaimsDesk {
  if (MOCKUP_DATA) {
    demo ??= createDeskDemo({ team: previewTeam })
    return demo
  }
  return deskRemote(remoteConfig())
}

export { deskFailure } from "@/lib/authors/deskRemote"
