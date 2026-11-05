import { formatDate, t } from "@/lib/i18n"
/**
 * Notifications: the inbox model and the pure reducers behind the bell.
 *
 * Phase 1 is local: lib/notifications/schedule.ts decides what should reach the person, the phone
 * schedules it (lib/notifications/native.ts) and every notification that has fired is kept here as an
 * inbox item. Phase 2 adds server items (docs/notifications.md). No React, no stores, no clock reads:
 * `now` is always passed in.
 */
export type NotificationKind =
  | "song"
  | "festival"
  | "words"
  | "story"
  | "streak"
  | "live"
  | "upload"
  | "announcement"

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

/** An inbox item older than this is dropped. */
export const INBOX_KEEP_DAYS = 30
const DAY_MS = 86_400_000

/* ------------------------------------------------------------------ time */

function dayStart(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Whole local calendar days from `a` to `b` (positive when b is later). */
function daysBetween(a: number, b: number): number {
  return Math.round((dayStart(b) - dayStart(a)) / DAY_MS)
}

/** The short time on a row: "8:00" today, "Yesterday", "Mon" within a week, "12 Oct" later. */
export function timeLabel(firedAt: number, now: number): string {
  const days = daysBetween(firedAt, now)
  const d = new Date(firedAt)
  if (days <= 0) return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`
  if (days === 1) return t("notif.yesterday")
  if (days < 7) return formatDate(d, "weekdayShort")
  return formatDate(d, "dayMonth")
}

/* --------------------------------------------------------------- reducers */

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

/**
 * "Today" then "Earlier", newest first inside each; an empty section is left out and anything older
 * than 30 days is dropped.
 */
export function sectionsOf(items: readonly AppNotification[], now: number): NotificationSection[] {
  const newest = [...items]
    .filter((n) => daysBetween(n.firedAt, now) < INBOX_KEEP_DAYS)
    .sort((a, b) => b.firedAt - a.firedAt || a.id.localeCompare(b.id))
  const today = newest.filter((n) => daysBetween(n.firedAt, now) <= 0)
  const earlier = newest.filter((n) => daysBetween(n.firedAt, now) > 0)
  const out: NotificationSection[] = []
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

function isOld(firedAt: number, now: number): boolean {
  return daysBetween(firedAt, now) >= INBOX_KEEP_DAYS
}

/** Drop what is older than 30 days from items and from the deleted memory. */
export function pruneInbox(state: InboxState, now: number): InboxState {
  const items = state.items.filter((n) => !isOld(n.firedAt, now))
  const deleted: Record<string, number> = {}
  for (const [id, firedAt] of Object.entries(state.deleted)) if (!isOld(firedAt, now)) deleted[id] = firedAt
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
    if (known.has(n.id) || n.id in state.deleted || n.firedAt > now || isOld(n.firedAt, now)) continue
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
