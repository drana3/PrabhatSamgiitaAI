import { useMemo } from "react"

import { inboxFixtures } from "@/lib/fixtures/notifications"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { sectionsOf, unreadCount, type AppNotification } from "@/lib/notifications"
import { nowMs } from "@/lib/notifications/clock"
import { useNotificationsStore } from "@/stores/notificationsStore"

/**
 * The inbox: what has fired (kept on the phone, filled by components/notifications/NotificationsHost),
 * which are read, and how many are not. In the preview the kinds with no local trigger yet (story,
 * upload, announcement) come from fixtures. TODO(api): the server sends those in phase 2.
 */
export function useNotificationItems() {
  const stored = useNotificationsStore((s) => s.items)
  const read = useNotificationsStore((s) => s.read)
  const deleted = useNotificationsStore((s) => s.deleted)
  return useMemo(() => {
    const now = nowMs()
    const samples: AppNotification[] = MOCKUP_DATA ? inboxFixtures(now).filter((n) => !(n.id in deleted)) : []
    const items: readonly AppNotification[] = [...stored, ...samples]
    const sections = sectionsOf(items, now)
    const visible = sections.flatMap((section) => section.items)
    return { items: visible, read, unread: unreadCount(visible, read), sections, now }
  }, [stored, read, deleted])
}
