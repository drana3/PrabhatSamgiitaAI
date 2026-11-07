import { commentFailure, commentsBackend } from "@/lib/songComments/backend"
import type { SongComment } from "@/lib/songComments/types"

import { useComments, type CommentsController } from "@/components/comments/useComments"

/** The comments of one Prabhat Samgiita song. The loading, posting and reporting are `useComments` (shared with the recording comments). */
export function useSongComments(songId: number): CommentsController<SongComment> {
  return useComments<SongComment, number>(songId, commentsBackend, commentFailure)
}
