import { remoteConfig } from "@/lib/kirtan/api"
import { MOCKUP_DATA } from "@/lib/mockupMode"

import { broadcastMockFailure, createBroadcastsMock } from "./mock"
import { broadcastFailureFromError, broadcastsRemote } from "./remote"
import type { BroadcastFailure, BroadcastsBackend } from "./types"

/** Which server the broadcasts talk to: the real API, or in the web preview an in-memory one. Chosen when asked, never at module load. */
let mock: BroadcastsBackend | null = null

export function broadcastsBackend(): BroadcastsBackend {
  if (MOCKUP_DATA) {
    mock ??= createBroadcastsMock()
    return mock
  }
  return broadcastsRemote(remoteConfig())
}

/** Any error of either backend as a failure the screens have a sentence for. */
export function broadcastFailure(error: unknown): BroadcastFailure {
  return broadcastMockFailure(error) ?? broadcastFailureFromError(error)
}
