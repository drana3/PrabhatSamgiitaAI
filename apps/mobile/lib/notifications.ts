/**
 * Notifications: the list model and the pure reducers behind the bell. The items themselves come
 * from the server later (TODO(api)); until then the preview shows lib/fixtures/home.ts.
 */
export type NotificationKind = "song" | "festival" | "words" | "story" | "streak"

export type AppNotification = {
  id: string
  kind: NotificationKind
  group: "today" | "earlier"
  title: string
  text: string
  /** "8:00", "Yesterday" */
  time: string
  /** where a tap goes (an app route) */
  target: string
  /** a song number whose cover the row shows */
  coverNumber?: number
}

export function unreadIds(items: readonly AppNotification[], read: readonly string[]): string[] {
  const done = new Set(read)
  return items.filter((n) => !done.has(n.id)).map((n) => n.id)
}

export function unreadCount(items: readonly AppNotification[], read: readonly string[]): number {
  return unreadIds(items, read).length
}

export function markRead(read: readonly string[], id: string): string[] {
  return read.includes(id) ? [...read] : [...read, id]
}

export function markAllRead(items: readonly AppNotification[], read: readonly string[]): string[] {
  return Array.from(new Set([...read, ...items.map((n) => n.id)]))
}

export type NotificationSection = { id: "today" | "earlier"; label: string; items: AppNotification[] }

/** "Today" then "Earlier"; an empty section is left out. */
export function sectionsOf(items: readonly AppNotification[]): NotificationSection[] {
  const today = items.filter((n) => n.group === "today")
  const earlier = items.filter((n) => n.group === "earlier")
  const out: NotificationSection[] = []
  if (today.length) out.push({ id: "today", label: "Today", items: today })
  if (earlier.length) out.push({ id: "earlier", label: "Earlier", items: earlier })
  return out
}
