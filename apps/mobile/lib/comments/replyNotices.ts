import { fetchNotices, markNoticeRead, type RemoteConfig, type RemoteNotice } from "@/lib/kirtan/remote"
import type { AppNotification } from "@/lib/notifications"
import { nowMs } from "@/lib/notifications/clock"
import { replyNotification } from "@/lib/notifications/serverKinds"
import { useNotificationsStore } from "@/stores/notificationsStore"

/**
 * "Somebody replied to your comment" reaches the phone as a server notice of kind `comment_reply` (the notices the
 * server keeps for the member: `GET /recordings/notices`). The phone asks for the unread ones when the app opens and
 * when it comes back to the front, turns each into an inbox item (lib/notifications/serverKinds.ts `replyNotification`),
 * hands them to the notification centre and marks them read on the server so they are not sent again. Notices of
 * other kinds are left alone. Never throws: a notice that cannot be made is not worth a crash.
 */
export const REPLY_NOTICE_KIND = "comment_reply"

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

/** The inbox items for the reply notices in a list from the server (pure). Anything malformed is skipped. */
export function replyItems(notices: readonly RemoteNotice[]): AppNotification[] {
  const out: AppNotification[] = []
  for (const notice of notices) {
    if (notice.kind !== REPLY_NOTICE_KIND) continue
    const payload = notice.payload ?? {}
    const parentId = text(payload.parent_id)
    const fired = Date.parse(notice.created_at)
    if (!parentId || !Number.isFinite(fired)) continue
    const song = typeof payload.song_id === "number" ? payload.song_id : undefined
    const item = replyNotification({
      noticeId: notice.id,
      from: text(payload.from_name),
      songNumber: song,
      recordingId: text(payload.recording_id) ?? notice.recording_id ?? undefined,
      parentId,
      firedAt: fired,
    })
    if (item) out.push(item)
  }
  return out
}

/** `config` is for tests; the app passes none and uses its own server address and the member's headers. */
export async function syncReplyNotices(config?: RemoteConfig): Promise<number> {
  try {
    // loaded only when needed: the server address and the member's headers pull in the app's client
    const wiring = config ? null : await import("@/lib/kirtan/api")
    if (wiring && !wiring.canUseServer()) return 0
    const cfg = config ?? wiring!.remoteConfig()
    const mine = (await fetchNotices(cfg, true)).filter((n) => n.kind === REPLY_NOTICE_KIND)
    if (mine.length === 0) return 0
    const items = replyItems(mine)
    if (items.length) useNotificationsStore.getState().receive(items, nowMs())
    // the notices are in the centre now (or cannot be made into items at all): the server need not send them again
    await Promise.allSettled(mine.map((n) => markNoticeRead(cfg, n.id)))
    return items.length
  } catch {
    return 0
  }
}
