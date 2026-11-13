import { formatNumber, t } from "@/lib/i18n"
import { isKiirtanNumber } from "@/lib/kirtan/track"

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
  { id: "500mb", get label() { return `${formatNumber(500)} ${t("unit.mb")}` }, bytes: 500 * MB },
  { id: "1gb", get label() { return `${formatNumber(1)} ${t("unit.gb")}` }, bytes: GB },
  { id: "2gb", get label() { return `${formatNumber(2)} ${t("unit.gb")}` }, bytes: 2 * GB },
  { id: "none", get label() { return t("storage.limit.none") }, bytes: null },
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
  const one = { minimumFractionDigits: 1, maximumFractionDigits: 1 }
  if (value < KB) return `${formatNumber(Math.round(value))} ${t("unit.b")}`
  if (value < MB) return `${formatNumber(Math.round(value / KB))} ${t("unit.kb")}`
  if (value < GB) {
    const mb = value / MB
    return mb < 100 ? `${formatNumber(mb, one)} ${t("unit.mb")}` : `${formatNumber(Math.round(mb))} ${t("unit.mb")}`
  }
  return `${formatNumber(value / GB, one)} ${t("unit.gb")}`
}

export function totalBytes(items: readonly StorageItem[]): number {
  return items.reduce((sum, item) => sum + (item.bytes > 0 ? item.bytes : 0), 0)
}

/** A new download may start only while the downloads on the phone are under the listener's limit. */
export function limitAllowsDownload(usedBytes: number, limitBytes: number | null): boolean {
  if (limitBytes == null) return true
  return usedBytes < limitBytes
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
  const recordings = t("storage.recordings", { count })
  return limit.bytes == null ? t("storage.legend.noLimit", { recordings }) : t("storage.legend.limit", { recordings, limit: limit.label })
}

/** Eyebrow of a storage row: `PS 3`, or `PS 3 · Version 2` when a song has several files. */
export function storageRowEyebrow(items: readonly StorageItem[], item: StorageItem): string {
  // A Kiirtan has a long internal number, not a catalog one.
  if (isKiirtanNumber(item.songNumber)) return t("storage.row.kiirtan")
  const sameSong = sortStorageItems(items.filter((other) => other.songNumber === item.songNumber))
  if (sameSong.length < 2) return `PS ${item.songNumber}`
  const index = sameSong.findIndex((other) => other.key === item.key)
  return t("storage.row.version", { number: item.songNumber, version: index + 1 })
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
 * Nothing selected: red `Clear all downloads · 16.9 MB`.
 * Rows selected: orange `Delete 2 selected · 8.3 MB`.
 * Empty list: hidden. Either press opens a confirm sheet; nothing is deleted before it.
 */
export function clearActionModel(input: {
  items: readonly StorageItem[]
  selected: readonly string[]
}): ClearActionModel {
  const { items } = input
  if (items.length === 0) return { visible: false }
  const selected = pruneSelection(input.selected, items)
  if (selected.length > 0) {
    return {
      visible: true,
      tone: "brand",
      mode: "selected",
      label: t("storage.clear.selected", { count: selected.length, size: formatBytes(selectedBytes(items, selected)) }),
    }
  }
  return {
    visible: true,
    tone: "danger",
    mode: "all",
    label: t("storage.clear.all", { size: formatBytes(totalBytes(items)) }),
  }
}

export type ClearPlan = {
  mode: "all" | "selected"
  /** keys to delete once the person confirms */
  keys: string[]
  /** bytes freed by `keys`, for the sheet and the toast */
  freedBytes: number
}

/** What a press on the pill would delete, or null when there is nothing to delete. */
export function planClear(input: { items: readonly StorageItem[]; selected: readonly string[] }): ClearPlan | null {
  const { items } = input
  if (items.length === 0) return null
  const selected = pruneSelection(input.selected, items)
  if (selected.length > 0) return { mode: "selected", keys: selected, freedBytes: selectedBytes(items, selected) }
  return { mode: "all", keys: items.map((item) => item.key), freedBytes: totalBytes(items) }
}

export type ClearConfirmCopy = { title: string; body: string; confirmLabel: string }

/** Words of the confirm sheet: how many files and how much space, and that songs saved to Mine stay. */
export function clearConfirmCopy(plan: ClearPlan): ClearConfirmCopy {
  const count = plan.keys.length
  const size = formatBytes(plan.freedBytes)
  const stay = t("storage.confirm.stay")
  if (plan.mode === "all") {
    return {
      title: t("storage.confirm.all.title"),
      body: t("storage.confirm.all.body", { count, size, stay }),
      confirmLabel: t("storage.confirm.all.confirm", { size }),
    }
  }
  return {
    title: t("storage.confirm.some.title", { count }),
    body: t("storage.confirm.some.body", { size, stay }),
    confirmLabel: t("storage.confirm.some.confirm", { size }),
  }
}

export function clearedToast(freedBytes: number): string {
  return t("storage.cleared", { size: formatBytes(freedBytes) })
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
