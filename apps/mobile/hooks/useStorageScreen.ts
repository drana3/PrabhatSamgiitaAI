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
  clearedToast,
  formatBytes,
  planTrim,
  pressClearAction,
  pruneSelection,
  toggleSelectAll,
  toggleSelection,
  totalBytes,
  type CacheLimitId,
  type StorageItem,
} from "@/lib/storageCache"
import { readCacheLimit, writeCacheLimit } from "@/lib/storageScan"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { useOfflineStorageItems } from "@/hooks/useOfflineStorageItems"

const ARM_TIMEOUT_MS = 4000

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
  const [armed, setArmed] = useState(false)
  const [toast, setToast] = useState<StorageToast | null>(null)
  const toastSeq = useRef(0)
  const trimming = useRef(false)

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

  useEffect(() => {
    setArmed(false)
  }, [selected, items.length])

  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [armed])

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

  // When the limit is full, the oldest downloads go first; songs saved to Mine stay.
  useEffect(() => {
    if (!scanned || !limitLoaded || trimming.current) return
    const keys = planTrim(items, limit.bytes, savedNumbers)
    if (keys.length === 0) return
    const freed = totalBytes(items.filter((item: StorageItem) => keys.includes(item.key)))
    trimming.current = true
    void removeKeys(keys).then(() => {
      trimming.current = false
      showToast(`${clearedToast(freed)} to fit ${limit.label}`)
    })
  }, [items, scanned, limitLoaded, limit, savedNumbers, removeKeys, showToast])

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

  const pressAction = useCallback(async () => {
    const press = pressClearAction({ items, selected, armed })
    setArmed(press.armed)
    if (press.toDelete === null) return
    setSelected([])
    await removeKeys(press.toDelete)
    showToast(clearedToast(press.freedBytes))
  }, [items, selected, armed, removeKeys, showToast])

  const action = clearActionModel({ items, selected, armed })

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
    toast,
  }
}
