import type { AppNotification } from "@/lib/notifications"
import { kindMeta } from "@/lib/notifications/kinds"

/**
 * Grouping in the centre. Several reminders of the same kind on the same local day (5 word reminders, 3 song
 * times) would fill the screen with near copies, so from `GROUP_MIN` of them they collapse into one row:
 * "Words to repeat, 4 today", newest text on top, a tap opens the group. Only kinds marked `groupable` in the
 * registry group; anything else, and groups smaller than the minimum, stay single rows. Pure.
 */

export const GROUP_MIN = 3

export type InboxRow =
  | { type: "item"; id: string; item: AppNotification }
  | { type: "group"; id: string; kind: AppNotification["kind"]; /** newest first */ items: AppNotification[] }

function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** Rows for one section, in the order of its items (newest first). A group sits where its newest item was. */
export function rowsOf(items: readonly AppNotification[]): InboxRow[] {
  const buckets = new Map<string, AppNotification[]>()
  for (const item of items) {
    if (!kindMeta(item.kind).groupable) continue
    const key = `${item.kind}|${dayKey(item.firedAt)}`
    buckets.set(key, [...(buckets.get(key) ?? []), item])
  }
  const out: InboxRow[] = []
  const placed = new Set<string>()
  for (const item of items) {
    const key = `${item.kind}|${dayKey(item.firedAt)}`
    const bucket = buckets.get(key)
    if (bucket && bucket.length >= GROUP_MIN) {
      if (placed.has(key)) continue
      placed.add(key)
      out.push({ type: "group", id: `group:${key}`, kind: item.kind, items: bucket })
    } else {
      out.push({ type: "item", id: item.id, item })
    }
  }
  return out
}
