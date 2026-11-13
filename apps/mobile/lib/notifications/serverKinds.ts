import { t } from "@/lib/i18n"
import { kindLabel } from "@/lib/kirtan/kind"
import type { RecordingKind } from "@/lib/kirtan/types"
import type { AppNotification } from "@/lib/notifications"

/**
 * The two kinds that only the server can trigger (phase 2, docs/notifications.md). The copy and the
 * shape are fixed here so the screens already know them.
 * A Kiirtan or Bhajan is published the moment it is uploaded (docs/kiirtan-publishing.md), so there is no
 * "approved" message. The one upload message is the takedown: the team removed a recording after looking at it,
 * with the reason and the way to answer. stores/kirtanStore builds it when the server's list of "my uploads"
 * says a recording that was live has been removed.
 */

export type UploadDecision = "published" | "removed"

/** A recording the person uploaded went live (`published`) or was taken down by the team (`removed`, with the reason). */
export function uploadDecisionNotification(input: {
  uploadId: string
  kind?: RecordingKind
  title: string
  decision: UploadDecision
  /** why it was removed (the team's words); only for `removed` */
  reason?: string
  firedAt: number
}): AppNotification {
  const label = kindLabel(input.kind)
  const title = input.title.trim() || t("notif.upload.yourItem", { kind: label })
  const removed = input.decision === "removed"
  const reason = input.reason?.trim()
  return {
    id: `upload:${input.uploadId}:${input.decision}`,
    kind: "upload",
    title: removed ? t("notif.upload.removed", { kind: label }) : t("notif.upload.published", { kind: label }),
    text: removed
      ? reason
        ? t("notif.upload.removedText", { title, reason })
        : t("notif.upload.removedNoReason", { title })
      : t("notif.upload.publishedText", { title }),
    target: "/v2/kiirtan",
    firedAt: input.firedAt,
  }
}

/** A message from the team to everyone (or to a group). */
export function announcementNotification(input: {
  announcementId: string
  title: string
  text: string
  target?: string
  firedAt: number
}): AppNotification {
  return {
    id: `announcement:${input.announcementId}`,
    kind: "announcement",
    title: input.title.trim() || t("notif.announcement.default"),
    text: input.text.trim(),
    target: input.target ?? "/v2/today",
    firedAt: input.firedAt,
  }
}

/**
 * Somebody answered a comment the person wrote, on a song or under a recording. The server writes one notice per
 * reply (`comment_reply`, docs/comment-replies.md); the words are made here, in the person's language. A reply sent
 * anonymously arrives without a name and reads "Someone". `group` is the top-level comment the reply hangs under, so
 * several replies to one comment fold into one row ("3 replies to your comment"). A tap opens that conversation:
 * the song page or the recording page with the comment's replies open.
 */
export function replyNotification(input: {
  noticeId: string
  /** the replier's name; null or empty when the reply is anonymous */
  from: string | null
  songNumber?: number
  recordingId?: string
  /** the top-level comment the reply is under */
  parentId: string
  firedAt: number
}): AppNotification | null {
  const target = replyTarget(input)
  if (!target) return null
  const name = input.from?.trim()
  return {
    id: `reply:${input.noticeId}`,
    kind: "reply",
    title: t("songComments.notice.title"),
    text: name ? t("songComments.notice.text", { name }) : t("songComments.notice.textAnonymous"),
    target,
    firedAt: input.firedAt,
    group: input.parentId,
  }
}

/** an id of a comment or a recording: letters, digits, dash and underscore only (the preview's are "mock-3-1") */
const UUID = /^[A-Za-z0-9_-]{1,64}$/

/** Where a reply notice opens: only ids of the expected shape go into a route. */
export function replyTarget(input: { songNumber?: number; recordingId?: string; parentId: string }): string | null {
  if (!UUID.test(input.parentId)) return null
  const query = `?comment=${encodeURIComponent(input.parentId)}`
  if (typeof input.songNumber === "number" && Number.isInteger(input.songNumber) && input.songNumber >= 1) {
    return `/song-v2/ps-${input.songNumber}${query}`
  }
  if (input.recordingId && UUID.test(input.recordingId)) return `/recording/${input.recordingId}${query}`
  return null
}
