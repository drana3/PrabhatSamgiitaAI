import { remoteConfig } from "@/lib/kirtan/api"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { commentFailure, previewName } from "@/lib/songComments/backend"
import { useAuthStore } from "@/stores/authStore"

import { createRecordingCommentsMock } from "./mock"
import { recordingCommentsRemote } from "./remote"
import type { RecordingCommentsBackend } from "./types"

/** Which server the recording comments talk to: the real API, or in the web preview an in-memory one. Chosen when asked. */
let mock: RecordingCommentsBackend | null = null

export function recordingCommentsBackend(): RecordingCommentsBackend {
  if (MOCKUP_DATA) {
    mock ??= createRecordingCommentsMock({ me: () => (useAuthStore.getState().mode === "signed_in" ? useAuthStore.getState().displayName : previewName()) })
    return mock
  }
  return recordingCommentsRemote(remoteConfig())
}

/** Any error of either backend as a failure the comments section has a sentence for (the song comments' mapping). */
export { commentFailure as recordingCommentFailure }
