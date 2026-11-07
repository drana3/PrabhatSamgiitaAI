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
  /** the line an author's own delete leaves behind (a top-level comment): no text, no author, nothing to act on. Its replies stay. */
  deleted?: boolean
  /** a reply: the top-level comment it hangs under (one level of replies only); absent or null for a top-level comment */
  parentId?: string | null
  /** a reply that answers another reply: who ("to Name"). `name` is null for an anonymous reply, `deleted` when that reply is gone. */
  replyTo?: ReplyTarget | null
  /** on a top-level comment: its live replies, oldest first */
  replies?: CommentBase[]
}

export type ReplyTarget = { name: string | null; deleted: boolean }

export type SongComment = CommentBase & { songId: number }

export type CommentPage<T extends CommentBase = SongComment> = {
  items: T[]
  /** everything the list pages through (a recording's tombstones included) */
  total: number
  /** the comments people can read: the number to show. Absent where there are no tombstones (then it is `total`). */
  liveTotal?: number
  hasMore: boolean
}

export type CommentReportReason = "offensive" | "spam" | "private" | "other"

/** What a person can be told when something goes wrong. Each has a sentence in locales/songComments.ts. */
export type CommentFailure =
  | "signin" // not signed in (or the session ran out)
  | "slowDown" // too many posts in a minute
  | "duplicate" // the same words were shared already
  | "empty" // nothing to post
  | "tooLong"
  | "links" // more than two links
  | "network" // no answer from the server (offline)
  | "gone" // the comment is not there any more (also: the comment a reply answers)
  | "threadFull" // a conversation holds 50 replies at most
  | "server"

export type PostOutcome<T extends CommentBase = SongComment> = { ok: true; comment: T } | { ok: false; failure: CommentFailure }

/** The four things a comments section asks of a server (the real one, or the in-memory one of the preview). `K` is what the comments hang on: a song number, a recording id. */
export interface CommentsBackendOf<T extends CommentBase, K> {
  list(target: K, query: { limit: number; offset: number }): Promise<CommentPage<T>>
  /** `parentId` answers a comment (a top-level one or a reply); the answer is attached to the top-level comment. */
  post(target: K, draft: { body: string; isAnonymous: boolean; parentId?: string }): Promise<T>
  remove(commentId: string): Promise<void>
  report(commentId: string, report: { reason: CommentReportReason }): Promise<{ status: "received" | "already_reported" }>
}

export type CommentsBackend = CommentsBackendOf<SongComment, number>
