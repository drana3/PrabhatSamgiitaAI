import { parseVideoUrl } from "./rules"
import type { VideoFailure } from "./types"

/**
 * The optional video link of the Kiirtan upload form (docs/kiirtan-video.md). A link belongs to ONE recording, so the field is
 * for a single file; with several files in the queue it is not offered (and a link typed before is not sent). The recording is
 * not on the server until its upload is done, so the link is sent the moment the row is done and its submission has the server's id.
 * A link that cannot be added does not undo the recording: the person is told, and adds it on the recording's page.
 */

/** Is the field offered? A Kiirtan only, and for one file at most. */
export function offersVideoLink(kind: string | null | undefined, files: number): boolean {
  return (kind ?? "kiirtan") === "kiirtan" && files <= 1
}

/** What the phone already knows about a typed link: empty is fine (the field is optional), a bad link says why. */
export function videoLinkProblem(raw: string): VideoFailure | null {
  if (!raw.trim()) return null
  const parsed = parseVideoUrl(raw)
  return parsed.ok ? null : parsed.failure
}

/** The address to send, or null when there is none or it is not good. */
export function videoLinkToSend(raw: string): string | null {
  if (!raw.trim()) return null
  const parsed = parseVideoUrl(raw)
  return parsed.ok ? parsed.url : null
}

/** One row of the queue as far as this needs: its state and the submission it became. */
export type LinkRow = { status: string; submissionId?: string }

/**
 * The server id of the recording the link goes to: the queue holds exactly one row, it is done, and its submission is up.
 * null until then (and for any other queue).
 */
export function linkTarget(rows: readonly LinkRow[], submissions: readonly { id: string; serverId?: string | null }[]): string | null {
  if (rows.length !== 1) return null
  const row = rows[0]
  if (!row || row.status !== "done" || !row.submissionId) return null
  const submission = submissions.find((s) => s.id === row.submissionId)
  return submission?.serverId ?? null
}
