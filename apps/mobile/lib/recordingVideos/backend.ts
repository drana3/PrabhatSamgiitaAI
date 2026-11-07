import { remoteConfig } from "@/lib/kirtan/api"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { previewName } from "@/lib/songComments/backend"

import { createVideosMock, videoMockFailure } from "./mock"
import { videoFailureFromError, videosRemote } from "./remote"
import type { VideoFailure, VideosBackend } from "./types"

/** Which server the video links talk to: the real API, or in the web preview an in-memory one. Chosen when asked, never at module load. */
let mock: VideosBackend | null = null

export function videosBackend(): VideosBackend {
  if (MOCKUP_DATA) {
    mock ??= createVideosMock({ me: previewName })
    return mock
  }
  return videosRemote(remoteConfig())
}

/** Any error of either backend as a failure the screens have a sentence for. */
export function videoFailure(error: unknown): VideoFailure {
  return videoMockFailure(error) ?? videoFailureFromError(error)
}
