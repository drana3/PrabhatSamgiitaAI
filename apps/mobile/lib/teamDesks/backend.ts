import { remoteConfig } from "@/lib/kirtan/api"

import { teamDesksRemote, type TeamDesks } from "./remote"

/** The server the team desks talk to. Chosen when asked, never at module load. */
export function teamDesks(): TeamDesks {
  return teamDesksRemote(remoteConfig())
}

export { deskDetail, deskFailure } from "./remote"
