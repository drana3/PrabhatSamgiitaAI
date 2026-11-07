import { createMockCore, mockFailure, MockFailure } from "./mockCore"
import type { CommentsBackend, SongComment } from "./types"

/**
 * The in-memory stand-in for the song comments API, used ONLY in the web preview (`EXPO_PUBLIC_MOCKUP_DATA=1`, see
 * lib/songComments/backend.ts). The rules live in mockCore.ts. The seed comments are sample text for the preview;
 * they are never shown in a real build.
 */

/** The name a named comment gets in the preview when nobody is signed in. */
export const PREVIEW_NAME = "Preview member"

export { MockFailure, mockFailure }

const MINUTE = 60_000

/** `me` is the name a named comment gets (the preview's signed-in name). */
export function createMockBackend(options: { me: () => string; now?: () => number } = { me: () => "You" }): CommentsBackend {
  return createMockCore<SongComment, number>({
    ...options,
    anchor: (songId) => ({ songId }),
    seed: (now) => [
      {
        top: {
          body: "Sample comment for the preview. I first heard this song at a retreat, and the last line stayed with me for weeks.",
          createdAt: new Date(now - 3 * 24 * 60 * MINUTE).toISOString(),
          isAnonymous: false,
          author: { name: PREVIEW_NAME, avatarUrl: null },
        },
        replies: [
          {
            body: "Sample reply for the preview. The same happened to me.",
            createdAt: new Date(now - 2 * 24 * 60 * MINUTE).toISOString(),
            isAnonymous: true,
            author: null,
          },
        ],
      },
      {
        top: {
          body: "Sample anonymous comment for the preview. Some things are easier to say without a name.",
          createdAt: new Date(now - 5 * 60 * MINUTE).toISOString(),
          isAnonymous: true,
          author: null,
        },
      },
    ],
  })
}
