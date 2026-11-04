import { useMemo } from "react"

import { HOME_NOTIFICATIONS } from "@/lib/fixtures/home"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { sectionsOf, unreadCount, type AppNotification } from "@/lib/notifications"
import { useNotificationsStore } from "@/stores/notificationsStore"

/**
 * The notification list, which ones are read, and how many are not.
 * TODO(api): the real list comes from the server; until then only the preview has items.
 */
export function useNotificationItems() {
  const read = useNotificationsStore((s) => s.read)
  const items: readonly AppNotification[] = MOCKUP_DATA ? HOME_NOTIFICATIONS : []
  return useMemo(
    () => ({ items, read, unread: unreadCount(items, read), sections: sectionsOf(items) }),
    [items, read],
  )
}
