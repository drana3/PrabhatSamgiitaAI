/**
 * Comments under a Prabhat Samgiita song (apps/api `/api/v1/song-comments`, docs/song-comments.md).
 *
 * `author` is null for an anonymous comment: the server never sends a name, an avatar or an id for it, and this
 * app never invents one. `mine` is true only for the signed-in author asking about their own comment.
 */
export type CommentAuthor = { name: string; avatarUrl: string | null }

/** What every comment has, under a song or under a recording; the list, its state and the section only need this. */
export type CommentBase = {
  id: string
  body: string
  createdAt: string
  isAnonymous: boolean
  author: CommentAuthor | null
  mine: boolean
  /** the team can remove any comment */
  canRemove: boolean
  /** the line an author's own delete leaves behind (recordings): no text, no author, nothing to act on */
  deleted?: boolean
}

export type SongComment = CommentBase & { songId: number }

export type CommentPage<T extends CommentBase = SongComment> = { items: T[]; total: number; hasMore: boolean }

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

export type PostOutcome<T extends CommentBase = SongComment> = { ok: true; comment: T } | { ok: false; failure: CommentFailure }

/** The four things a comments section asks of a server (the real one, or the in-memory one of the preview). `K` is what the comments hang on: a song number, a recording id. */
export interface CommentsBackendOf<T extends CommentBase, K> {
  list(target: K, query: { limit: number; offset: number }): Promise<CommentPage<T>>
  post(target: K, draft: { body: string; isAnonymous: boolean }): Promise<T>
  remove(commentId: string): Promise<void>
  report(commentId: string, report: { reason: CommentReportReason }): Promise<{ status: "received" | "already_reported" }>
}

export type CommentsBackend = CommentsBackendOf<SongComment, number>
