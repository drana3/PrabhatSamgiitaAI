import { formatDate, formatTime, t } from "@/lib/i18n"
import { isImportant, type NotificationKind } from "@/lib/notifications/kinds"
import {
  DELETED_KEEP_DAYS,
  INBOX_KEEP_DAYS,
  capItems,
  daysBetween,
  isExpired,
  isUnread,
} from "@/lib/notifications/retention"
/**
 * Notifications: the inbox model and the pure reducers behind the bell.
 *
 * Phase 1 is local: lib/notifications/schedule.ts decides what should reach the person, the phone
 * schedules it (lib/notifications/native.ts) and every notification that has fired is kept here as an
 * inbox item. Phase 2 adds server items (docs/notifications.md). No React, no stores, no clock reads:
 * `now` is always passed in.
 */
export type { NotificationKind }
export { INBOX_KEEP_DAYS }

export type AppNotification = {
  /** deterministic ("song:2026-11-05"): the same event always gets the same id */
  id: string
  kind: NotificationKind
  title: string
  text: string
  /** where a tap goes (an app route) */
  target: string
  /** when it fired (ms since epoch) */
  firedAt: number
  /** a song number whose cover the row shows */
  coverNumber?: number
}

/*
 * How long an item stays is decided per kind (lib/notifications/kinds.ts, lib/notifications/retention.ts):
 * reminders 14 days, stories and team messages 30, a live notice 2, a notice about the person's own upload 90
 * (180 while unread); at most 100 ordinary items. INBOX_KEEP_DAYS (30) is the longest an ordinary item can stay.
 */

/* ------------------------------------------------------------------ time */

/** The short time on a row: "8:00" today, "Yesterday", "Mon" within a week, "12 Oct" later. */
export function timeLabel(firedAt: number, now: number): string {
  const days = daysBetween(firedAt, now)
  const d = new Date(firedAt)
  // the same 12 or 24 hour clock as the phone's language shows in Notification settings
  if (days <= 0) return formatTime(d)
  if (days === 1) return t("notif.yesterday")
  if (days < 7) return formatDate(d, "weekdayShort")
  return formatDate(d, "dayMonth")
}

/* --------------------------------------------------------------- reducers */

/** `now` makes a reminder that stayed unread for a week stop counting (retention.ts `isUnread`); without it every item not opened counts. */
export function unreadIds(items: readonly AppNotification[], read: readonly string[], now?: number): string[] {
  const done = new Set(read)
  return items.filter((n) => (now == null ? !done.has(n.id) : isUnread(n, done, now))).map((n) => n.id)
}

export function unreadCount(items: readonly AppNotification[], read: readonly string[], now?: number): number {
  return unreadIds(items, read, now).length
}

export function markRead(read: readonly string[], id: string): string[] {
  return read.includes(id) ? [...read] : [...read, id]
}

export function markAllRead(items: readonly AppNotification[], read: readonly string[]): string[] {
  return Array.from(new Set([...read, ...items.map((n) => n.id)]))
}

export type NotificationSection = { id: "important" | "today" | "earlier"; label: string; items: AppNotification[] }

/**
 * "Important" (unread notices about the person's own content, whatever their age), then "Today", then
 * "Earlier", newest first inside each; an empty section is left out and anything past its keep time is
 * dropped. Without `read` there is no "Important" section.
 */
export function sectionsOf(items: readonly AppNotification[], now: number, read?: readonly string[]): NotificationSection[] {
  const done = new Set(read ?? [])
  const newest = [...items]
    .filter((n) => !isExpired(n, done, now))
    .sort((a, b) => b.firedAt - a.firedAt || a.id.localeCompare(b.id))
  const pinned = read ? newest.filter((n) => isImportant(n.kind) && !done.has(n.id)) : []
  const rest = newest.filter((n) => !pinned.includes(n))
  const today = rest.filter((n) => daysBetween(n.firedAt, now) <= 0)
  const earlier = rest.filter((n) => daysBetween(n.firedAt, now) > 0)
  const out: NotificationSection[] = []
  if (pinned.length) out.push({ id: "important", label: t("notif.inbox.section.important"), items: pinned })
  if (today.length) out.push({ id: "today", label: t("notif.inbox.section.today"), items: today })
  if (earlier.length) out.push({ id: "earlier", label: t("notif.inbox.section.earlier"), items: earlier })
  return out
}

/* ------------------------------------------------------------------ inbox */

/** What the inbox store keeps. */
export type InboxState = {
  items: AppNotification[]
  /** ids opened or marked read */
  read: string[]
  /** ids the person deleted, with when they fired; stops a deleted item from coming back */
  deleted: Record<string, number>
  /** when the inbox last looked for newly fired notifications */
  syncedAt: number | null
}

export const EMPTY_INBOX: InboxState = { items: [], read: [], deleted: {}, syncedAt: null }

/**
 * Drop what has outlived its kind (retention.ts), keep the newest 100 ordinary and 50 important items, and
 * forget deleted ids and read ids that no item needs any more.
 */
export function pruneInbox(state: InboxState, now: number): InboxState {
  const done = new Set(state.read)
  const ordered = [...state.items].sort((a, b) => b.firedAt - a.firedAt || a.id.localeCompare(b.id))
  const items = capItems(ordered.filter((n) => !isExpired(n, done, now)))
  const deleted: Record<string, number> = {}
  for (const [id, firedAt] of Object.entries(state.deleted)) if (daysBetween(firedAt, now) < DELETED_KEEP_DAYS) deleted[id] = firedAt
  // read ids are tiny; a cap keeps the list from growing for ever (sample items are not in `items`)
  return { ...state, items, read: state.read.slice(-300), deleted }
}

/**
 * Add notifications that have fired. An id that is already there, or was deleted, is not added again,
 * so asking twice for the same window changes nothing.
 */
export function receiveFired(state: InboxState, fired: readonly AppNotification[], now: number): InboxState {
  const known = new Set(state.items.map((n) => n.id))
  const added: AppNotification[] = []
  for (const n of fired) {
    if (known.has(n.id) || n.id in state.deleted || n.firedAt > now || isExpired(n, state.read, now)) continue
    known.add(n.id)
    added.push(n)
  }
  const merged = [...state.items, ...added].sort((a, b) => b.firedAt - a.firedAt || a.id.localeCompare(b.id))
  return pruneInbox({ ...state, items: merged, syncedAt: now }, now)
}

/** Delete one item (also a sample item that is not in `items`). */
export function removeItem(state: InboxState, id: string, firedAt: number): InboxState {
  return {
    ...state,
    items: state.items.filter((n) => n.id !== id),
    read: state.read.filter((r) => r !== id),
    deleted: { ...state.deleted, [id]: firedAt },
  }
}

/** Undo a delete: the item is back, and the memory that kept it away is cleared. */
export function restoreItem(state: InboxState, item: AppNotification, now: number): InboxState {
  const deleted = { ...state.deleted }
  delete deleted[item.id]
  if (state.items.some((n) => n.id === item.id)) return { ...state, deleted }
  return pruneInbox({ ...state, items: [...state.items, item], deleted }, now)
}

/**
 * "Clear all": every item goes (and is remembered as deleted so it does not come back), except unread
 * important items: a removal notice must be read before it can disappear. Returns the new state and how many were kept.
 */
export function clearAll(state: InboxState, now: number): { state: InboxState; kept: number } {
  const done = new Set(state.read)
  const keep = state.items.filter((n) => isImportant(n.kind) && !done.has(n.id))
  const deleted = { ...state.deleted }
  for (const n of state.items) if (!keep.includes(n)) deleted[n.id] = n.firedAt
  const next: InboxState = {
    ...state,
    items: keep,
    read: state.read.filter((id) => !(id in deleted)),
    deleted,
  }
  return { state: pruneInbox(next, now), kept: keep.length }
}

/** How many unread important items `clearAll` would keep (for the confirm text). */
export function keptByClearAll(items: readonly AppNotification[], read: readonly string[]): number {
  const done = new Set(read)
  return items.filter((n) => isImportant(n.kind) && !done.has(n.id)).length
}
