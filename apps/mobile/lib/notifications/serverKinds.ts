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
