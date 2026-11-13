import { remoteConfig } from "@/lib/kirtan/api"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useKirtanStore } from "@/stores/kirtanStore"

import { createMoodMock, moodMockFailure } from "./mock"
import { moodFailureFromError, moodRemote } from "./remote"
import type { MoodBackend, MoodFailure } from "./types"

/** Which server the moods talk to: the real API, or in the web preview an in-memory one. Chosen when asked, never at module load. */
let mock: MoodBackend | null = null

const mineInPreview = (id: string) => useKirtanStore.getState().submissions.some((x) => x.id === id || x.serverId === id)

export function moodBackend(): MoodBackend {
  if (MOCKUP_DATA) {
    mock ??= createMoodMock({ isMine: mineInPreview })
    return mock
  }
  return moodRemote(remoteConfig())
}

/** Any error of either backend as a failure the screen has a sentence for. */
export function moodFailure(error: unknown): MoodFailure {
  return moodMockFailure(error) ?? moodFailureFromError(error)
}
