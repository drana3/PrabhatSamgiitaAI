/**
 * Comments under a Prabhat Samgiita song (apps/api `/api/v1/song-comments`, docs/song-comments.md).
 *
 * `author` is null for an anonymous comment: the server never sends a name, an avatar or an id for it, and this
 * app never invents one. `mine` is true only for the signed-in author asking about their own comment.
 */
export type CommentAuthor = { name: string; avatarUrl: string | null }

export type SongComment = {
  id: string
  songId: number
  body: string
  createdAt: string
  isAnonymous: boolean
  author: CommentAuthor | null
  mine: boolean
  /** the team can remove any comment */
  canRemove: boolean
}

export type CommentPage = { items: SongComment[]; total: number; hasMore: boolean }

export type CommentReportReason = "offensive" | "spam" | "private" | "other"

/** What a person can be told when something goes wrong. Each has a sentence in locales/songComments.ts. */
export type CommentFailure =
  | "signin" // not signed in (or the session ran out)
  | "dailyLimit" // too many comments today
  | "slowDown" // too many in an hour
  | "duplicate" // the same words were shared already
  | "empty" // nothing to post
  | "tooLong"
  | "links" // more than two links
  | "network" // no answer from the server (offline)
  | "gone" // the comment is not there any more
  | "server"

export type PostOutcome = { ok: true; comment: SongComment } | { ok: false; failure: CommentFailure }

/** The five things the section asks of a server (the real one, or the in-memory one of the preview). */
export interface CommentsBackend {
  list(songId: number, query: { limit: number; offset: number }): Promise<CommentPage>
  post(songId: number, draft: { body: string; isAnonymous: boolean }): Promise<SongComment>
  remove(commentId: string): Promise<void>
  report(commentId: string, report: { reason: CommentReportReason }): Promise<{ status: "received" | "already_reported" }>
}
