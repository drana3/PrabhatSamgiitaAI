import { remoteConfig } from "@/lib/kirtan/api"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useAuthStore } from "@/stores/authStore"

import { PREVIEW_NAME, createMockBackend, mockFailure } from "./mock"
import { failureFromError, remoteBackend } from "./remote"
import type { CommentFailure, CommentsBackend } from "./types"

/**
 * Which server the comments section talks to: the real API, or in the web preview (`EXPO_PUBLIC_MOCKUP_DATA=1`) an
 * in-memory one that keeps comments until the page is reloaded. Chosen when asked, never at module load.
 */
let mock: CommentsBackend | null = null

export function commentsBackend(): CommentsBackend {
  if (MOCKUP_DATA) {
    mock ??= createMockBackend({ me: () => (useAuthStore.getState().mode === "signed_in" ? useAuthStore.getState().displayName : PREVIEW_NAME) })
    return mock
  }
  return remoteBackend(remoteConfig())
}

/** One place that turns any error of either backend into a failure the section has a sentence for. */
/** One place that turns any error of either backend into a failure the section has a sentence for. */
/** The name shown for a named comment while previewing. */
export function previewName(): string {
  return useAuthStore.getState().mode === "signed_in" ? useAuthStore.getState().displayName : PREVIEW_NAME
}

export function commentFailure(error: unknown): CommentFailure {
  return mockFailure(error) ?? failureFromError(error)
}
