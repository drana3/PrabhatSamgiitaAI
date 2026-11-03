/**
 * Pure logic for Storage and downloads (spec SCR-20): sizes, totals, limit,
 * selection, the two-tap clear action and oldest-first trimming.
 * No React Native or file-system imports, so every rule is unit tested.
 */

export type StorageItem = {
  /** remote URL: the key of the offline audio index */
  key: string
  songNumber: number
  bytes: number
  /** file modification time, epoch ms; 0 when unknown */
  modifiedMs: number
}

export const KB = 1024
export const MB = 1024 * KB
export const GB = 1024 * MB

export type CacheLimitId = "500mb" | "1gb" | "2gb" | "none"

export type CacheLimit = {
  id: CacheLimitId
  label: string
  /** null = no limit */
  bytes: number | null
}

export const CACHE_LIMITS: readonly CacheLimit[] = [
  { id: "500mb", label: "500 MB", bytes: 500 * MB },
  { id: "1gb", label: "1 GB", bytes: GB },
  { id: "2gb", label: "2 GB", bytes: 2 * GB },
  { id: "none", label: "No limit", bytes: null },
]

export const DEFAULT_CACHE_LIMIT: CacheLimitId = "1gb"

export function parseCacheLimitId(raw: string | null | undefined): CacheLimitId {
  const found = CACHE_LIMITS.find((limit) => limit.id === raw)
  return found ? found.id : DEFAULT_CACHE_LIMIT
}

export function cacheLimitById(id: CacheLimitId): CacheLimit {
  return CACHE_LIMITS.find((limit) => limit.id === id) ?? CACHE_LIMITS[1]
}

/** `16.9 MB`, `812 KB`, `1.2 GB`. Binary units, one decimal under 100 MB. */
export function formatBytes(bytes: number): string {
  const value = Number.isFinite(bytes) && bytes > 0 ? bytes : 0
  if (value < KB) return `${Math.round(value)} B`
  if (value < MB) return `${Math.round(value / KB)} KB`
  if (value < GB) {
    const mb = value / MB
    return mb < 100 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`
  }
  return `${(value / GB).toFixed(1)} GB`
}

export function totalBytes(items: readonly StorageItem[]): number {
  return items.reduce((sum, item) => sum + (item.bytes > 0 ? item.bytes : 0), 0)
}

/** Fill of the usage bar, 0 to 1. No limit means an empty bar. */
export function usageRatio(total: number, limitBytes: number | null): number {
  if (limitBytes == null || limitBytes <= 0 || total <= 0) return 0
  return Math.min(1, total / limitBytes)
}

/** Sorted by song, then newest file first, then key for a stable order. */
export function sortStorageItems(items: readonly StorageItem[]): StorageItem[] {
  return [...items].sort(
    (a, b) =>
      a.songNumber - b.songNumber ||
      b.modifiedMs - a.modifiedMs ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  )
}

/** `4 recordings · limit 1 GB` */
export function storageLegend(count: number, limit: CacheLimit): string {
  const noun = count === 1 ? "recording" : "recordings"
  return `${count} ${noun} · ${limit.bytes == null ? "no limit" : `limit ${limit.label}`}`
}

/** Eyebrow of a storage row: `PS 3`, or `PS 3 · Version 2` when a song has several files. */
export function storageRowEyebrow(items: readonly StorageItem[], item: StorageItem): string {
  const sameSong = sortStorageItems(items.filter((other) => other.songNumber === item.songNumber))
  if (sameSong.length < 2) return `PS ${item.songNumber}`
  const index = sameSong.findIndex((other) => other.key === item.key)
  return `PS ${item.songNumber} · Version ${index + 1}`
}

/* Selection ----------------------------------------------------------- */

export function toggleSelection(selected: readonly string[], key: string): string[] {
  return selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]
}

export function allSelected(items: readonly StorageItem[], selected: readonly string[]): boolean {
  return items.length > 0 && items.every((item) => selected.includes(item.key))
}

/** `Select all` / `Deselect all`: returns the new selection. */
export function toggleSelectAll(items: readonly StorageItem[], selected: readonly string[]): string[] {
  return allSelected(items, selected) ? [] : items.map((item) => item.key)
}

/** Drop keys whose file no longer exists. */
export function pruneSelection(selected: readonly string[], items: readonly StorageItem[]): string[] {
  const live = new Set(items.map((item) => item.key))
  return selected.filter((key) => live.has(key))
}

export function selectedBytes(items: readonly StorageItem[], selected: readonly string[]): number {
  return totalBytes(items.filter((item) => selected.includes(item.key)))
}

/* The floating clear action -------------------------------------------- */

export type ClearActionModel =
  | { visible: false }
  | {
      visible: true
      tone: "danger" | "brand"
      label: string
      mode: "all" | "selected"
    }

/**
 * Nothing selected: red `Clear all downloads · 16.9 MB`, then `Tap again to clear all`.
 * Rows selected: orange `Clear selected · 2 · 8.3 MB`.
 * Empty list: hidden.
 */
export function clearActionModel(input: {
  items: readonly StorageItem[]
  selected: readonly string[]
  armed: boolean
}): ClearActionModel {
  const { items, armed } = input
  if (items.length === 0) return { visible: false }
  const selected = pruneSelection(input.selected, items)
  if (selected.length > 0) {
    return {
      visible: true,
      tone: "brand",
      mode: "selected",
      label: `Clear selected · ${selected.length} · ${formatBytes(selectedBytes(items, selected))}`,
    }
  }
  return {
    visible: true,
    tone: "danger",
    mode: "all",
    label: armed ? "Tap again to clear all" : `Clear all downloads · ${formatBytes(totalBytes(items))}`,
  }
}

export type ClearPress = {
  /** the pill is armed for a second tap */
  armed: boolean
  /** keys to delete now, or null when this tap only arms the pill */
  toDelete: string[] | null
  /** bytes freed by `toDelete`, for the toast */
  freedBytes: number
}

/** One tap on the pill. Selected rows delete at once; clear-all needs a second tap, no modal. */
export function pressClearAction(input: {
  items: readonly StorageItem[]
  selected: readonly string[]
  armed: boolean
}): ClearPress {
  const { items } = input
  if (items.length === 0) return { armed: false, toDelete: null, freedBytes: 0 }
  const selected = pruneSelection(input.selected, items)
  if (selected.length > 0) {
    return { armed: false, toDelete: selected, freedBytes: selectedBytes(items, selected) }
  }
  if (!input.armed) return { armed: true, toDelete: null, freedBytes: 0 }
  return { armed: false, toDelete: items.map((item) => item.key), freedBytes: totalBytes(items) }
}

export function clearedToast(freedBytes: number): string {
  return `Cleared ${formatBytes(freedBytes)}`
}

/* Limit enforcement ----------------------------------------------------- */

/**
 * Keys to delete so the total fits the limit: oldest files first.
 * Songs in `protectedSongs` (saved to Mine) are never removed automatically.
 */
export function planTrim(
  items: readonly StorageItem[],
  limitBytes: number | null,
  protectedSongs: ReadonlySet<number>,
): string[] {
  if (limitBytes == null) return []
  let total = totalBytes(items)
  if (total <= limitBytes) return []
  const candidates = items
    .filter((item) => !protectedSongs.has(item.songNumber))
    .sort((a, b) => a.modifiedMs - b.modifiedMs || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  const out: string[] = []
  for (const item of candidates) {
    if (total <= limitBytes) break
    out.push(item.key)
    total -= item.bytes
  }
  return out
}
