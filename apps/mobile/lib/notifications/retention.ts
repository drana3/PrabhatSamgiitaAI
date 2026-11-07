import { kindMeta } from "@/lib/notifications/kinds"

/**
 * How long the centre keeps things, what counts as unread, and what the app icon shows.
 * Pure: `now` is always passed in. The numbers and the reasons are in docs/notifications.md ("Retention").
 */

const DAY_MS = 86_400_000

/** What an item with no say of its own is kept for, and the longest an ordinary item is kept. */
export const INBOX_KEEP_DAYS = 30

/** At most this many ordinary (reminder) items are kept; the oldest go first. Important items have their own cap. */
export const MAX_ORDINARY_ITEMS = 100
export const MAX_IMPORTANT_ITEMS = 50

/**
 * A reminder that has stayed unread this long stops counting as unread (no dot, not in the badge): a
 * reminder is worth something on its day. Important items never go stale.
 */
export const STALE_UNREAD_DAYS = 7

/** The deleted-ids memory (which stops a deleted item from coming back) is kept as long as the longest-lived item. */
export const DELETED_KEEP_DAYS = 90

/** Delivered notifications still in the lock screen and the shade after this many hours are removed by the app (native.ts `dismissStalePresented`). */
export const STALE_PRESENTED_HOURS = 48

/** The most the badge on the app icon shows. */
export const BADGE_MAX = 99

/** The most local notifications one day can hold: 3 song + 5 word times + the festival eve + the streak reminder. */
export const MAX_LOCAL_PER_DAY = 10

type Aged = { id: string; kind: string; firedAt: number }

/** Whole local calendar days from `a` to `b` (positive when b is later). */
export function daysBetween(a: number, b: number): number {
  const da = new Date(a)
  const db = new Date(b)
  const sa = new Date(da.getFullYear(), da.getMonth(), da.getDate()).getTime()
  const sb = new Date(db.getFullYear(), db.getMonth(), db.getDate()).getTime()
  return Math.round((sb - sa) / DAY_MS)
}

/**
 * Has the item outlived its time? An important item that is still unread is kept longer (`unreadKeepDays`);
 * once read it goes by `keepDays`.
 */
export function isExpired(item: Aged, read: ReadonlySet<string> | readonly string[], now: number): boolean {
  const meta = kindMeta(item.kind)
  const age = daysBetween(item.firedAt, now)
  const isRead = read instanceof Set ? read.has(item.id) : (read as readonly string[]).includes(item.id)
  const limit = meta.tier === "important" && !isRead ? (meta.unreadKeepDays ?? meta.keepDays) : meta.keepDays
  return age >= limit
}

/** Unread, as the dot and the badge see it: not opened, and (for a reminder) not older than STALE_UNREAD_DAYS. */
export function isUnread(item: Aged, read: ReadonlySet<string> | readonly string[], now: number): boolean {
  const isRead = read instanceof Set ? read.has(item.id) : (read as readonly string[]).includes(item.id)
  if (isRead) return false
  if (kindMeta(item.kind).tier === "important") return true
  return daysBetween(item.firedAt, now) < STALE_UNREAD_DAYS
}

/** The number on the app icon: unread items, at most BADGE_MAX. */
export function badgeCount(items: readonly Aged[], read: readonly string[], now: number): number {
  const done = new Set(read)
  let n = 0
  for (const item of items) if (isUnread(item, done, now)) n += 1
  return Math.min(n, BADGE_MAX)
}

/**
 * Keep at most `MAX_ORDINARY_ITEMS` ordinary and `MAX_IMPORTANT_ITEMS` important items, the newest.
 * `items` must be newest first.
 */
export function capItems<T extends Aged>(items: readonly T[]): T[] {
  let ordinary = 0
  let important = 0
  const out: T[] = []
  for (const item of items) {
    if (kindMeta(item.kind).tier === "important") {
      if (important >= MAX_IMPORTANT_ITEMS) continue
      important += 1
    } else {
      if (ordinary >= MAX_ORDINARY_ITEMS) continue
      ordinary += 1
    }
    out.push(item)
  }
  return out
}
