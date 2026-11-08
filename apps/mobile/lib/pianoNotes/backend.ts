import { remoteConfig } from "@/lib/kirtan/api"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { previewName } from "@/lib/songComments/backend"

import { createPianoMock, pianoMockFailure } from "./mock"
import { pianoFailureFromError, pianoRemote } from "./remote"
import type { PianoBackend, PianoFailure } from "./types"

/** Which server the piano notes talk to: the real API, or in the web preview an in-memory one. Chosen when asked, never at module load. */
let mock: PianoBackend | null = null

export function pianoBackend(): PianoBackend {
  if (MOCKUP_DATA) {
    mock ??= createPianoMock({ me: previewName })
    return mock
  }
  return pianoRemote(remoteConfig())
}

/** Any error of either backend as a failure the screens have a sentence for. */
export function pianoFailure(error: unknown): PianoFailure {
  return pianoMockFailure(error) ?? pianoFailureFromError(error)
}
