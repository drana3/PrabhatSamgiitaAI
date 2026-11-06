import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { MOCK_STORAGE } from "@/lib/fixtures/songsMock"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useOfflineAudioStore } from "@/lib/offlineAudio"
import { savedNewestFirst } from "@/lib/mineView"
import { parseSongNumber } from "@/lib/songMap"
import {
  DEFAULT_CACHE_LIMIT,
  allSelected as allSelectedOf,
  cacheLimitById,
  clearActionModel,
  clearConfirmCopy,
  clearedToast,
  formatBytes,
  planClear,
  planTrim,
  pruneSelection,
  toggleSelectAll,
  toggleSelection,
  totalBytes,
  type CacheLimitId,
  type ClearPlan,
  type StorageItem,
} from "@/lib/storageCache"
import { readCacheLimit, writeCacheLimit } from "@/lib/storageScan"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { useOfflineStorageItems } from "@/hooks/useOfflineStorageItems"
import { orphanBytes, removeOrphans, scanOrphans, type Orphan } from "@/lib/offline/orphans"
import { t } from "@/lib/i18n"

export type StorageToast = { id: number; text: string }

/** State and actions of the Storage and downloads screen (spec SCR-20). */
export function useStorageScreen() {
  const real = useOfflineStorageItems()
  // Preview (MOCKUP_DATA): the four downloads of the prototype, removable in place.
  const [mockItems, setMockItems] = useState<StorageItem[]>(() => MOCK_STORAGE.map((m) => ({ key: m.key, songNumber: m.songNumber, bytes: m.bytes, modifiedMs: m.modifiedMs })))
  const items = MOCKUP_DATA ? mockItems : real.items
  const scanned = MOCKUP_DATA ? true : real.scanned
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)
  const [limitId, setLimitId] = useState<CacheLimitId>(DEFAULT_CACHE_LIMIT)
  const [limitLoaded, setLimitLoaded] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  // the plan waiting for the person's confirmation (nothing is deleted before it)
  const [pending, setPending] = useState<ClearPlan | null>(null)
  const [toast, setToast] = useState<StorageToast | null>(null)
  const toastSeq = useRef(0)
  // files in the download folder that nothing records (see lib/offline/orphans.ts)
  const [orphans, setOrphans] = useState<Orphan[]>([])
  const [orphanPlan, setOrphanPlan] = useState<Orphan[] | null>(null)
  const wifiOnly = usePreferencesStore((s) => s.downloadWifiOnly)
  const setWifiOnly = usePreferencesStore((s) => s.setDownloadWifiOnly)
  const askedTrim = useRef("")

  const limit = cacheLimitById(limitId)
  const total = useMemo(() => totalBytes(items), [items])
  const savedNumbers = useMemo(
    () =>
      new Set(
        savedNewestFirst(
          savedSongIds.flatMap((id: string) => {
            const n = parseSongNumber(id)
            return n ? [n] : []
          }),
        ),
      ),
    [savedSongIds],
  )

  const showToast = useCallback((text: string) => {
    toastSeq.current += 1
    setToast({ id: toastSeq.current, text })
  }, [])

  // look for leftovers whenever the list of downloads changes (and once the list is known)
  const scannedOnce = scanned
  useEffect(() => {
    if (MOCKUP_DATA || !scannedOnce) return
    let active = true
    void scanOrphans().then((found) => active && setOrphans(found))
    return () => {
      active = false
    }
  }, [items, scannedOnce])

  useEffect(() => {
    void readCacheLimit().then((id: CacheLimitId) => {
      setLimitId(id)
      setLimitLoaded(true)
    })
  }, [])

  // Selection and the armed state follow the list.
  useEffect(() => {
    setSelected((current: string[]) => {
      const next = pruneSelection(current, items)
      return next.length === current.length ? current : next
    })
  }, [items])

  // a sheet that no longer matches the list (a file vanished) closes
  useEffect(() => {
    setPending((current: ClearPlan | null) => (current && current.keys.every((k) => items.some((i: StorageItem) => i.key === k)) ? current : null))
  }, [items])

  const removeKeys = useCallback(async (keys: string[]) => {
    if (MOCKUP_DATA) {
      setMockItems((cur) => cur.filter((item) => !keys.includes(item.key)))
      return
    }
    const remove = useOfflineAudioStore.getState().remove
    for (const key of keys) {
      await remove(key)
    }
  }, [])

  // Over the limit: the oldest downloads are proposed (songs saved to Mine stay) and the listener
  // confirms. Nothing is deleted without asking. Cancelling is remembered until the list changes.
  useEffect(() => {
    if (!scanned || !limitLoaded) return
    const keys = planTrim(items, limit.bytes, savedNumbers)
    if (keys.length === 0) {
      askedTrim.current = ""
      return
    }
    const signature = keys.join("|")
    if (askedTrim.current === signature) return
    askedTrim.current = signature
    const freed = totalBytes(items.filter((item: StorageItem) => keys.includes(item.key)))
    setSelected(keys)
    setPending({ mode: "selected", keys, freedBytes: freed })
    showToast(t("storage.toast.over", { limit: limit.label }))
  }, [items, scanned, limitLoaded, limit, savedNumbers, showToast])

  const chooseLimit = useCallback((id: CacheLimitId) => {
    setLimitId(id)
    void writeCacheLimit(id)
  }, [])

  const toggleRow = useCallback((key: string) => {
    setSelected((current: string[]) => toggleSelection(current, key))
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((current: string[]) => toggleSelectAll(items, current))
  }, [items])

  /** The pill: opens the confirm sheet with the count and size. */
  const pressAction = useCallback(() => {
    setPending(planClear({ items, selected }))
  }, [items, selected])

  const cancelClear = useCallback(() => setPending(null), [])

  /** "Delete" in the sheet: removes the files, clears the selection, totals follow the list. */
  const confirmClear = useCallback(async () => {
    const plan = pending
    setPending(null)
    if (!plan) return
    setSelected([])
    await removeKeys(plan.keys)
    showToast(clearedToast(plan.freedBytes))
  }, [pending, removeKeys, showToast])

  /** "Remove" on the leftovers row: the confirm sheet first, nothing is deleted before it. */
  const askRemoveOrphans = useCallback(() => setOrphanPlan(orphans), [orphans])
  const confirmRemoveOrphans = useCallback(async () => {
    const plan = orphanPlan
    setOrphanPlan(null)
    if (!plan?.length) return
    const freed = await removeOrphans(plan)
    setOrphans(await scanOrphans())
    showToast(clearedToast(freed))
  }, [orphanPlan, showToast])
  const orphanCopy = useMemo(
    () =>
      orphanPlan
        ? {
            title: t("storage.orphans.confirm.title"),
            body: t("storage.orphans.confirm.body", { size: formatBytes(orphanBytes(orphanPlan)) }),
            confirmLabel: t("storage.orphans.confirm.confirm", { size: formatBytes(orphanBytes(orphanPlan)) }),
          }
        : null,
    [orphanPlan],
  )

  const action = clearActionModel({ items, selected })
  const confirm = useMemo(() => (pending ? clearConfirmCopy(pending) : null), [pending])

  return {
    items,
    scanned,
    total,
    totalLabel: formatBytes(total),
    limit,
    chooseLimit,
    selected,
    allSelected: allSelectedOf(items, selected),
    toggleRow,
    toggleAll,
    action,
    pressAction,
    confirm,
    cancelClear,
    confirmClear,
    toast,
    wifiOnly,
    setWifiOnly,
    orphans,
    orphanBytes: orphanBytes(orphans),
    askRemoveOrphans,
    orphanCopy,
    confirmRemoveOrphans,
    cancelRemoveOrphans: () => setOrphanPlan(null),
  }
}
