import { useMemo } from "react"

import { kiirtanDownloadItem } from "@/lib/offline/downloadItems"
import type { KiirtanSource } from "@/lib/kirtan/track"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useOfflineAudioStore } from "@/lib/offlineAudio"
import { useDemoDownloads } from "@/lib/playerV2/demoDownloads"

/**
 * The Kiirtans and Bhajans that are on the phone right now (the "Downloaded" chip of the Kiirtan
 * tab). Same source of truth as every download control: the offline audio service, or the preview's
 * demo downloads. Order of `kirtans` is kept.
 */
export function useDownloadedKirtans<T extends KiirtanSource>(kirtans: readonly T[]): T[] {
  const files = useOfflineAudioStore((s) => s.files)
  const demoDone = useDemoDownloads((d) => d.done)
  return useMemo(() => {
    if (MOCKUP_DATA) {
      const numbers = new Set(Object.keys(demoDone).map((key) => Number(key.split("-")[0])))
      return kirtans.filter((k) => numbers.has(kiirtanDownloadItem(k).number))
    }
    const urls = new Set(Object.values(files).map((f) => f.remoteUrl))
    return kirtans.filter((k) => {
      const url = kiirtanDownloadItem(k).url
      return url ? urls.has(url) : false
    })
  }, [kirtans, files, demoDone])
}
