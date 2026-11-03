import { useEffect, useState } from "react"

import { ensureOfflineAudioReady, useOfflineAudioStore } from "@/lib/offlineAudio"
import { scanOfflineStorage } from "@/lib/storageScan"
import type { StorageItem } from "@/lib/storageCache"

/** Downloaded recordings with real file sizes. Rescans whenever the offline index changes. */
export function useOfflineStorageItems(): { items: StorageItem[]; scanned: boolean } {
  const files = useOfflineAudioStore((s) => s.files)
  const ready = useOfflineAudioStore((s) => s.ready)
  const [items, setItems] = useState<StorageItem[]>([])
  const [scanned, setScanned] = useState(false)

  useEffect(() => {
    void ensureOfflineAudioReady()
  }, [])

  useEffect(() => {
    if (!ready) return
    let active = true
    void scanOfflineStorage(files).then((next: StorageItem[]) => {
      if (!active) return
      setItems(next)
      setScanned(true)
    })
    return () => {
      active = false
    }
  }, [files, ready])

  return { items, scanned }
}
