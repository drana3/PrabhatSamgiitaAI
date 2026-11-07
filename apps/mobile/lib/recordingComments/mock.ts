import { createMockCore } from "@/lib/songComments/mockCore"

import type { RecordingComment, RecordingCommentsBackend } from "./types"

/**
 * The in-memory stand-in for the recording comments API, used ONLY in the web preview (`EXPO_PUBLIC_MOCKUP_DATA=1`).
 * The rules live in lib/songComments/mockCore.ts. The seed is sample text for the preview; a real build never shows it.
 */
const MINUTE = 60_000

export function createRecordingCommentsMock(options: { me: () => string; now?: () => number } = { me: () => "You" }): RecordingCommentsBackend {
  return createMockCore<RecordingComment, string>({
    ...options,
    anchor: (recordingId) => ({ recordingId }),
    seed: (now) => [
      {
        top: {
          body: "Sample comment for the preview. We sang this at the end of the retreat and nobody wanted to stop.",
          createdAt: new Date(now - 2 * 24 * 60 * MINUTE).toISOString(),
          isAnonymous: false,
          author: { name: "Preview member", avatarUrl: null },
        },
      },
    ],
  })
}
