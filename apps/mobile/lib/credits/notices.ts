import { t } from "@/lib/i18n"
import { fetchNotices, markNoticeRead, type RemoteConfig, type RemoteNotice } from "@/lib/kirtan/remote"
import type { AppNotification } from "@/lib/notifications"
import { nowMs } from "@/lib/notifications/clock"
import { useNotificationsStore } from "@/stores/notificationsStore"

/**
 * The server's notices about people named on recordings (docs/co-performers.md, "Messages") reach the phone as five kinds and
 * become items of the notification centre (kind `credit`):
 *  - `credit_invite`: to the person named: "X added you on “Title”", opens the invitations;
 *  - `credit_accepted`, `credit_declined`, `credit_expired`: to the uploader: one line, opens the people of that recording;
 *  - `credit_removed`: to the person the team took off a recording, opens "My credits".
 * The title is made here, in the person's language; the line of the three uploader notices is the server's own sentence (it
 * carries the name and the recording title, which the payload does not).
 */
export const CREDIT_NOTICE_KINDS = ["credit_invite", "credit_accepted", "credit_declined", "credit_expired", "credit_removed"] as const

const ID = /^[A-Za-z0-9-]{1,64}$/

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/** The inbox item of one credit notice, or null when it is malformed or of another kind (pure). */
export function creditItem(notice: RemoteNotice): AppNotification | null {
  const fired = Date.parse(notice.created_at)
  if (!Number.isFinite(fired)) return null
  const payload = notice.payload ?? {}
  const recording = notice.recording_id && ID.test(notice.recording_id) ? notice.recording_id : null
  const line = text(notice.body) ?? text(notice.title)

  switch (notice.kind) {
    case "credit_invite": {
      const title = text(payload.recording_title)
      if (!title) return null
      const role = payload.role === "author" ? "author" : "performer"
      return { id: `credit:${notice.id}`, kind: "credit", title: t("credits.notice.title.invite"), text: t(`credits.notice.invite.${role}` as "credits.notice.invite.performer", { title }), target: "/credit-invites", firedAt: fired }
    }
    case "credit_accepted":
    case "credit_declined":
    case "credit_expired": {
      if (!line) return null
      const which = notice.kind.slice("credit_".length) as "accepted" | "declined" | "expired"
      return { id: `credit:${notice.id}`, kind: "credit", title: t(`credits.notice.title.${which}` as "credits.notice.title.accepted"), text: line, target: recording ? `/recording-people?id=${recording}` : "/my-credits", firedAt: fired }
    }
    case "credit_removed":
      return { id: `credit:${notice.id}`, kind: "credit", title: t("credits.notice.title.removed"), text: line ?? t("credits.notice.removed"), target: "/my-credits", firedAt: fired }
    default:
      return null
  }
}

/** The inbox items for the credit notices in a list from the server (pure). */
export function creditItems(notices: readonly RemoteNotice[]): AppNotification[] {
  const out: AppNotification[] = []
  for (const notice of notices) {
    if (!(CREDIT_NOTICE_KINDS as readonly string[]).includes(notice.kind)) continue
    const item = creditItem(notice)
    if (item) out.push(item)
  }
  return out
}

/** `config` is for tests; the app passes none and uses its own server address and the member's headers. Never throws. */
export async function syncCreditNotices(config?: RemoteConfig): Promise<number> {
  try {
    const wiring = config ? null : await import("@/lib/kirtan/api")
    if (wiring && !wiring.canUseServer()) return 0
    const cfg = config ?? wiring!.remoteConfig()
    const mine = (await fetchNotices(cfg, true)).filter((n) => (CREDIT_NOTICE_KINDS as readonly string[]).includes(n.kind))
    if (mine.length === 0) return 0
    const items = creditItems(mine)
    if (items.length) useNotificationsStore.getState().receive(items, nowMs())
    await Promise.allSettled(mine.map((n) => markNoticeRead(cfg, n.id)))
    return items.length
  } catch {
    return 0
  }
}
