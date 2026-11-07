import type { CommentBase, CommentsBackendOf } from "@/lib/songComments/types"

/**
 * A comment under a recording (apps/api `/api/v1/recording-comments`, docs/recording-extras.md). The same shape as a
 * song comment, hung on a recording id instead of a song number. `author` is null for an anonymous comment.
 */
export type RecordingComment = CommentBase & { recordingId: string }

export type RecordingCommentsBackend = CommentsBackendOf<RecordingComment, string>
