import type { RemoteConfig } from "@/lib/kirtan/remote"
import { callFor } from "@/lib/recordingExtras/http"
import { COMMENT_PAGE_SIZE } from "@/lib/songComments/rules"
import { replyFieldsFromWire } from "@/lib/songComments/remote"
import { tombstoneOf } from "@/lib/songComments/state"
import type { CommentBase, CommentPage, CommentReportReason } from "@/lib/songComments/types"

import type { RecordingComment, RecordingCommentsBackend } from "./types"

/** The phone's side of the recording comments API. The error mapping is the song comments' own (`failureFromError`). */
const call = callFor("/api/v1/recording-comments")

/** `RecordingCommentOut` of the API. */
export type WireRecordingComment = {
  id: string
  recording_id: string
  body: string
  created_at: string
  is_anonymous: boolean
  author: { name: string; avatar_url: string | null } | null
  mine: boolean
  can_remove: boolean
  /** the line an author's own delete leaves: no text, no author */
  deleted?: boolean
  parent_id?: string | null
  reply_to?: { name: string | null; deleted: boolean } | null
  replies?: WireRecordingComment[]
}

export type WireRecordingPage = { items: WireRecordingComment[]; total: number; live_total?: number; limit: number; offset: number; has_more: boolean }

/** Wire to app. An anonymous comment keeps `author: null` whatever else the answer carries; a tombstone carries no text, author or action. */
export function recordingCommentFromWire(w: WireRecordingComment): RecordingComment {
  const replyFields = replyFieldsFromWire(w, recordingCommentFromWire as (reply: never) => CommentBase)
  if (w.deleted) return tombstoneOf({ id: w.id, recordingId: w.recording_id, body: "", createdAt: w.created_at, isAnonymous: true, author: null, mine: false, canRemove: false, ...replyFields })
  return {
    id: w.id,
    recordingId: w.recording_id,
    body: w.body,
    createdAt: w.created_at,
    isAnonymous: w.is_anonymous,
    author: w.is_anonymous || !w.author ? null : { name: w.author.name, avatarUrl: w.author.avatar_url ?? null },
    mine: Boolean(w.mine),
    canRemove: Boolean(w.can_remove),
    ...replyFields,
  }
}

export function recordingPageFromWire(w: WireRecordingPage): CommentPage<RecordingComment> {
  return { items: w.items.map(recordingCommentFromWire), total: w.total, liveTotal: w.live_total ?? w.total, hasMore: w.has_more }
}

export function recordingCommentsRemote(cfg: RemoteConfig): RecordingCommentsBackend {
  return {
    async list(recordingId, query) {
      const params = new URLSearchParams({ limit: String(query.limit || COMMENT_PAGE_SIZE), offset: String(query.offset) })
      return recordingPageFromWire(await call<WireRecordingPage>(cfg, "GET", `/recordings/${encodeURIComponent(recordingId)}?${params.toString()}`))
    },
    async post(recordingId, draft) {
      const body: Record<string, unknown> = { body: draft.body, is_anonymous: draft.isAnonymous }
      if (draft.parentId) body.parent_id = draft.parentId
      return recordingCommentFromWire(await call<WireRecordingComment>(cfg, "POST", `/recordings/${encodeURIComponent(recordingId)}`, body))
    },
    async remove(commentId) {
      await call<void>(cfg, "DELETE", `/${encodeURIComponent(commentId)}`)
    },
    async report(commentId, report: { reason: CommentReportReason }) {
      return call<{ status: "received" | "already_reported" }>(cfg, "POST", `/${encodeURIComponent(commentId)}/report`, { reason: report.reason })
    },
  }
}
