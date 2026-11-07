/**
 * My listening history: what this person heard on this phone. Local only: nothing here is sent anywhere and there is
 * no server table behind it. An entry exists only after a COUNTED play (the same rule the server uses for an author's
 * statistics, lib/authors/plays.ts: 30 seconds, or half of a short track, never under 10), once per track per day.
 * Pure: no React, no storage, no clock of its own.
 */

/** Newest entries kept; the oldest go first. */
export const HISTORY_CAP = 500

export type HistoryEntry = {
  /** `${itemKey}@${YYYY-MM-DD}`: one entry per track per day (a track heard twice in a day is one entry, moved to the top) */
  id: string
  /** "ps:123" for a Prabhat Samgiita song, "rec:<app id>" for a recording */
  itemKey: string
  ref: "ps" | "rec"
  /** the song number (ps) or the recording's app id (rec) */
  itemId: string
  title: string
  /** a recording kind id ("kiirtan", "bhajan", "baba_audio" ...) or "prabhat_samgiita" */
  kind: string
  /** performer text as the author wrote it (recordings only) */
  author?: string
  /** ISO language code (Bhajans and spiritual songs) */
  language?: string
  /** ms since epoch of the start of the listen */
  at: number
}

export type HistoryGroupKey = "today" | "yesterday" | "earlier"
export type HistoryGroup = { key: HistoryGroupKey; entries: HistoryEntry[] }

const pad = (n: number) => String(n).padStart(2, "0")

/** Local calendar day, `YYYY-MM-DD`. */
export function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function startOfDay(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function entryId(itemKey: string, at: number): string {
  return `${itemKey}@${dayKey(at)}`
}

export function makeEntry(input: Omit<HistoryEntry, "id" | "itemKey"> & { itemKey?: string }): HistoryEntry {
  const itemKey = input.itemKey ?? `${input.ref}:${input.itemId}`
  return { ...input, itemKey, id: entryId(itemKey, input.at) }
}

/** Add an entry at the top. The same track on the same day replaces the older entry; the list is capped. */
export function addEntry(list: readonly HistoryEntry[], entry: HistoryEntry, cap = HISTORY_CAP): HistoryEntry[] {
  const rest = list.filter((e) => e.id !== entry.id)
  return [entry, ...rest].slice(0, cap)
}

export function removeEntry(list: readonly HistoryEntry[], id: string): HistoryEntry[] {
  return list.filter((e) => e.id !== id)
}

/** Today, Yesterday, Earlier (local days); empty groups are left out; inside a group newest first. */
export function groupHistory(list: readonly HistoryEntry[], now: number): HistoryGroup[] {
  const today = startOfDay(now)
  const yesterday = startOfDay(today - 12 * 3600 * 1000)
  const groups: Record<HistoryGroupKey, HistoryEntry[]> = { today: [], yesterday: [], earlier: [] }
  for (const e of [...list].sort((a, b) => b.at - a.at)) {
    if (e.at >= today) groups.today.push(e)
    else if (e.at >= yesterday) groups.yesterday.push(e)
    else groups.earlier.push(e)
  }
  return (["today", "yesterday", "earlier"] as const)
    .filter((key) => groups[key].length > 0)
    .map((key) => ({ key, entries: groups[key] }))
}

/** A value read back from storage that is not an entry is dropped (a hand-edited or old store must not crash the screen). */
export function sanitizeHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return []
  const out: HistoryEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const e = item as Partial<HistoryEntry>
    if (typeof e.id !== "string" || typeof e.itemKey !== "string" || typeof e.title !== "string") continue
    if (typeof e.at !== "number" || !Number.isFinite(e.at)) continue
    if (e.ref !== "ps" && e.ref !== "rec") continue
    out.push({
      id: e.id,
      itemKey: e.itemKey,
      ref: e.ref,
      itemId: String(e.itemId ?? ""),
      title: e.title,
      kind: typeof e.kind === "string" ? e.kind : "kiirtan",
      ...(typeof e.author === "string" ? { author: e.author } : {}),
      ...(typeof e.language === "string" ? { language: e.language } : {}),
      at: e.at,
    })
  }
  return out.slice(0, HISTORY_CAP)
}
