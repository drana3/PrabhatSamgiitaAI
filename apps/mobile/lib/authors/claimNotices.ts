import { t } from "@/lib/i18n"
import { fetchNotices, markNoticeRead, type RemoteConfig, type RemoteNotice } from "@/lib/kirtan/remote"
import type { AppNotification } from "@/lib/notifications"
import { nowMs } from "@/lib/notifications/clock"
import { useNotificationsStore } from "@/stores/notificationsStore"

/**
 * The server's notices about author claims reach the phone as notices of four kinds and become items of the notification
 * centre (docs/author-profiles.md, "Messages"):
 *  - `claim_approved`, `claim_rejected`, `claim_revoked`: to the owner of an author page, one per page and decision
 *    (kind `claim` in the centre);
 *  - `claim_on_your_recording`: to the person who added a recording that an author page now shows (kind `onpage`).
 * The words are made here, in the person's language. A notice that cannot be made into an item is skipped. Notices of other
 * kinds are left alone (the reply notices have their own sync).
 */
export const CLAIM_NOTICE_KINDS = ["claim_approved", "claim_rejected", "claim_revoked", "claim_on_your_recording"] as const

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1
}

/** The inbox item of one claim notice, or null when it is malformed or of another kind (pure). */
export function claimItem(notice: RemoteNotice): AppNotification | null {
  const payload = notice.payload ?? {}
  const fired = Date.parse(notice.created_at)
  if (!Number.isFinite(fired)) return null
  const slug = text(payload.profile_slug)
  const page = slug && SLUG.test(slug) ? `/author/${encodeURIComponent(slug)}` : null

  if (notice.kind === "claim_on_your_recording") {
    const title = text(payload.recording_title)
    const name = text(payload.page_name)
    if (!title || !name || !page) return null
    return {
      id: `onpage:${notice.id}`,
      kind: "onpage",
      title: t("claimNotice.title.onpage"),
      text: t("claimNotice.onpage", { title, page: name }),
      target: page,
      firedAt: fired,
    }
  }

  const decision = notice.kind === "claim_approved" ? "approved" : notice.kind === "claim_rejected" ? "rejected" : notice.kind === "claim_revoked" ? "revoked" : null
  if (!decision) return null
  const note = text(payload.note)
  const line = t(`claimNotice.${decision}` as "claimNotice.approved", { count: count(payload.count) })
  return {
    id: `claim:${notice.id}`,
    kind: "claim",
    title: t(`claimNotice.title.${decision}` as "claimNotice.title.approved"),
    text: note ? `${line} ${t("claimNotice.note", { note })}` : line,
    // a declined request opens the list of requests; the others open the page itself
    target: decision === "rejected" || !page ? "/author-claims" : page,
    firedAt: fired,
  }
}

/** The inbox items for the claim notices in a list from the server (pure). */
export function claimItems(notices: readonly RemoteNotice[]): AppNotification[] {
  const out: AppNotification[] = []
  for (const notice of notices) {
    if (!(CLAIM_NOTICE_KINDS as readonly string[]).includes(notice.kind)) continue
    const item = claimItem(notice)
    if (item) out.push(item)
  }
  return out
}

/** `config` is for tests; the app passes none and uses its own server address and the member's headers. Never throws. */
export async function syncClaimNotices(config?: RemoteConfig): Promise<number> {
  try {
    const wiring = config ? null : await import("@/lib/kirtan/api")
    if (wiring && !wiring.canUseServer()) return 0
    const cfg = config ?? wiring!.remoteConfig()
    const mine = (await fetchNotices(cfg, true)).filter((n) => (CLAIM_NOTICE_KINDS as readonly string[]).includes(n.kind))
    if (mine.length === 0) return 0
    const items = claimItems(mine)
    if (items.length) useNotificationsStore.getState().receive(items, nowMs())
    await Promise.allSettled(mine.map((n) => markNoticeRead(cfg, n.id)))
    return items.length
  } catch {
    return 0
  }
}
