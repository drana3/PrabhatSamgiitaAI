import { kindLabel } from "@/lib/kirtan/kind"
import type { RecordingKind } from "@/lib/kirtan/types"
import type { AppNotification } from "@/lib/notifications"

/**
 * The two kinds that only the server can trigger (phase 2, docs/notifications.md). The copy and the
 * shape are fixed here so the screens already know them; nothing calls these yet.
 * TODO(api): the backend sends an upload decision and a team announcement; map its payload with these.
 */

export type UploadDecision = "approved" | "rejected"

/** An uploaded Kiirtan or Bhajan was approved or rejected. `title` is its title; `kind` picks the word (a Kiirtan when missing). */
export function uploadDecisionNotification(input: {
  uploadId: string
  kind?: RecordingKind
  title: string
  decision: UploadDecision
  firedAt: number
}): AppNotification {
  const label = kindLabel(input.kind)
  const title = input.title.trim() || `Your ${label}`
  const approved = input.decision === "approved"
  return {
    id: `upload:${input.uploadId}:${input.decision}`,
    kind: "upload",
    title: approved ? `${label} approved` : `${label} not approved`,
    text: approved ? `${title} is now in the library.` : `${title} did not pass review. See why.`,
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
    title: input.title.trim() || "From the team",
    text: input.text.trim(),
    target: input.target ?? "/v2/today",
    firedAt: input.firedAt,
  }
}
