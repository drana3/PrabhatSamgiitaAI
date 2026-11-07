import { canUseServer, remoteConfig } from "@/lib/kirtan/api"
import { authorBlockKey } from "@/lib/kirtan/list"
import { blockAuthor, fetchBlockedAuthors, sendReport, unblockAuthor, type ReportOutcome } from "@/lib/kirtan/remote"
import type { ReportReason } from "@/lib/kirtan/rules"
import type { Kirtan } from "@/lib/kirtan/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useKirtanStore } from "@/stores/kirtanStore"

/**
 * Report and Block for a Kiirtan or a Bhajan (App Store 1.2, Play UGC). Both are on every recording: the player
 * menu, the row menu and the artist page. A report goes to the server for real (`POST /recordings/{id}/report`), anyone
 * may send it. A block hides the author's recordings on this device at once and is sent to the server for signed-in members.
 * In the demo preview there is no server: nothing is faked about the result, the report is only kept on this device and
 * the sheet says so ("Demo: not sent").
 */

export type ReportResult = ReportOutcome & { demo: boolean }

/** Sends a report. Throws (RemoteError / NetworkError) when the server could not be reached; the sheet shows a retry. */
export async function reportRecording(k: Pick<Kirtan, "id" | "serverId">, report: { reason: ReportReason; comment?: string }): Promise<ReportResult> {
  if (MOCKUP_DATA || !k.serverId) {
    useKirtanStore.getState().markReported(k.id)
    return { status: "received", message: "", demo: true }
  }
  const outcome = await sendReport(remoteConfig(), k.serverId, report)
  useKirtanStore.getState().markReported(k.id)
  return { ...outcome, demo: false }
}

/** Can this recording's author be blocked? A real build needs the uploader's account id; the preview blocks by name. */
export function canBlockAuthor(k: Pick<Kirtan, "authorId" | "author">): boolean {
  return authorBlockKey(k, MOCKUP_DATA) !== null
}

/** Hides the author's recordings now, then tells the server (only for a signed-in member with an account id). */
export async function blockAuthorOf(k: Pick<Kirtan, "authorId" | "author">): Promise<void> {
  const key = authorBlockKey(k, MOCKUP_DATA)
  if (!key) return
  useKirtanStore.getState().blockAuthor(key, k.author.trim() || undefined)
  if (k.authorId && !MOCKUP_DATA && canUseServer()) await blockAuthor(remoteConfig(), k.authorId)
}

export async function unblockAuthorOf(key: string): Promise<void> {
  useKirtanStore.getState().unblockAuthor(key)
  if (!key.startsWith("name:") && !MOCKUP_DATA && canUseServer()) await unblockAuthor(remoteConfig(), key)
}

/** Takes the server's list of blocked authors into the phone's list (after sign-in, on another device). */
export async function syncBlockedAuthors(): Promise<void> {
  if (MOCKUP_DATA || !canUseServer()) return
  useKirtanStore.getState().setBlockedAuthors(await fetchBlockedAuthors(remoteConfig()))
}
