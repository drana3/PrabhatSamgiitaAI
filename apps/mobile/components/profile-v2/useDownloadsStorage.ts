import { useEffect, useState } from "react"
import * as FileSystem from "expo-file-system/legacy"

import { useOfflineAudioStore } from "@/lib/offlineAudio"

/**
 * Total size of saved recordings for the Storage row. The store keeps file
 * locations, not sizes, so the sizes are read from disk when the sheet opens.
 */
export function useDownloadsStorage(): { bytes: number | null; fileCount: number } {
  const files = useOfflineAudioStore((s) => s.files)
  const uris = Object.values(files)
    .map((entry) => entry.fileUri)
    .sort()
  const key = uris.join("|")
  const [bytes, setBytes] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    if (!uris.length) {
      setBytes(0)
      return
    }
    void (async () => {
      let total = 0
      for (const uri of uris) {
        try {
          const info = await FileSystem.getInfoAsync(uri)
          if (info.exists && typeof info.size === "number") total += info.size
        } catch {
          // A file that cannot be read adds nothing to the total.
        }
      }
      if (active) setBytes(total)
    })()
    return () => {
      active = false
    }
    // `key` stands for the list of files
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { bytes, fileCount: uris.length }
}
