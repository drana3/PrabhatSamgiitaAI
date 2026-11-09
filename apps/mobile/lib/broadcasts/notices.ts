import { t } from "@/lib/i18n"
import { fetchNotices, markNoticeRead, type RemoteConfig, type RemoteNotice } from "@/lib/kirtan/remote"
import type { AppNotification } from "@/lib/notifications"
import { nowMs } from "@/lib/notifications/clock"
import { useNotificationsStore } from "@/stores/notificationsStore"

/**
 * What the team decided about a broadcast reaches its author as a server notice of three kinds and becomes an item of the
 * notification centre (docs/broadcasts.md, "Moderation"):
 *  - `broadcast_hidden`: the team took it off the lists (the author and the team still read it), with the reason;
 *  - `broadcast_removed`: the team removed it, with the reason;
 *  - `broadcast_restored`: the team looked again and it is back on the lists.
 * The words are made here, in the person's language. A removal and a hiding are "important" items (kind `upload`): they stay
 * until read. A notice that cannot be made into an item is skipped; notices of other kinds are left alone.
 */
export const BROADCAST_NOTICE_KINDS = ["broadcast_hidden", "broadcast_removed", "broadcast_restored"] as const
type Kind = (typeof BROADCAST_NOTICE_KINDS)[number]

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null)

/** The inbox item of one broadcast notice, or null when it is malformed or of another kind (pure). */
export function broadcastItem(notice: RemoteNotice): AppNotification | null {
  if (!(BROADCAST_NOTICE_KINDS as readonly string[]).includes(notice.kind)) return null
  const fired = Date.parse(notice.created_at)
  if (!Number.isFinite(fired)) return null
  const payload = notice.payload ?? {}
  const title = text(payload.broadcast_title)
  const id = text(payload.broadcast_id)
  if (!title || !id || !SAFE_ID.test(id)) return null
  const kind = notice.kind as Kind
  const reason = text(payload.reason)
  const name = kind === "broadcast_hidden" ? "hidden" : kind === "broadcast_removed" ? "removed" : "restored"
  const body = reason && name !== "restored" ? t(`bc.notice.${name}.reason` as "bc.notice.hidden.reason", { title, reason }) : t(`bc.notice.${name}` as "bc.notice.hidden", { title })
  return {
    id: `broadcast:${notice.id}`,
    kind: "upload",
    title: t(`bc.notice.${name}.title` as "bc.notice.hidden.title"),
    text: body,
    // a removed broadcast has no page for anybody but its author and the team: the author's own list is the safe place
    target: name === "removed" ? "/broadcasts?tab=mine" : `/broadcast/${encodeURIComponent(id)}`,
    firedAt: fired,
  }
}

export function broadcastItems(notices: readonly RemoteNotice[]): AppNotification[] {
  const out: AppNotification[] = []
  for (const notice of notices) {
    const item = broadcastItem(notice)
    if (item) out.push(item)
  }
  return out
}

/** `config` is for tests; the app passes none and uses its own server address and the member's headers. Never throws. */
export async function syncBroadcastNotices(config?: RemoteConfig): Promise<number> {
  try {
    const wiring = config ? null : await import("@/lib/kirtan/api")
    if (wiring && !wiring.canUseServer()) return 0
    const cfg = config ?? wiring!.remoteConfig()
    const mine = (await fetchNotices(cfg, true)).filter((n) => (BROADCAST_NOTICE_KINDS as readonly string[]).includes(n.kind))
    if (mine.length === 0) return 0
    const items = broadcastItems(mine)
    if (items.length) useNotificationsStore.getState().receive(items, nowMs())
    await Promise.allSettled(mine.map((n) => markNoticeRead(cfg, n.id)))
    return items.length
  } catch {
    return 0
  }
}
