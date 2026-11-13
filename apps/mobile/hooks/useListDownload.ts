import { useCallback, useMemo } from "react"

import {
  confirmRemoveMany,
  startMany,
  stopMany,
  useDownloadQueue,
} from "@/lib/offline/downloadActions"
import { songDownloadItem } from "@/lib/offline/downloadItems"
import {
  listDownloadView,
  type DownloadItem,
  type ListDownloadView,
} from "@/lib/offline/downloadModel"
import { useDownloadUiStore } from "@/stores/downloadUiStore"
import { DOWNLOAD_ALL_LIMIT } from "@/lib/songsV2/listPage"
import { isKiirtanNumber } from "@/lib/kirtan/track"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useOfflineAudioStore } from "@/lib/offlineAudio"
import { hasPlayableAudio } from "@/lib/playableAudio"
import { useDemoDownloads } from "@/lib/playerV2/demoDownloads"

function itemOf(number: number): DownloadItem {
  return isKiirtanNumber(number) ? { kind: "kiirtan", number } : songDownloadItem(number)
}

/**
 * The download toggle of a list (a playlist, Mine, a collection): counts over the songs that have
 * playable audio, "Downloading 3 of 12", and a press that starts, stops or (after a confirm)
 * removes. Signed out: the same sign-in prompt as every other download control.
 */
export function useListDownload(numbers: readonly number[], name: string): { view: ListDownloadView; press: () => void } {
  const files = useOfflineAudioStore((s) => s.files)
  const activeBySong = useOfflineAudioStore((s) => s.activeBySong)
  const progress = useOfflineAudioStore((s) => s.progress)
  const demoDone = useDemoDownloads((d) => d.done)
  const demoProgress = useDemoDownloads((d) => d.progress)
  const pending = useDownloadQueue((s) => s.pending)

  const downloaded = useMemo(
    () =>
      MOCKUP_DATA
        ? new Set(Object.keys(demoDone).map((key) => Number(key.split("-")[0])))
        : new Set(Object.values(files).map((f) => f.songNumber)),
    [demoDone, files],
  )
  const running = useMemo(() => {
    const map = new Map<number, number>()
    if (MOCKUP_DATA) {
      for (const [key, value] of Object.entries(demoProgress)) map.set(Number(key.split("-")[0]), value)
    } else {
      for (const [number, url] of Object.entries(activeBySong)) map.set(Number(number), progress[url] ?? 0)
    }
    for (const item of pending) if (!map.has(item.number)) map.set(item.number, 0)
    return map
  }, [demoProgress, activeBySong, progress, pending])

  const view = useMemo(() => listDownloadView(numbers, downloaded, running, hasPlayableAudio), [numbers, downloaded, running])

  const press = useCallback(() => {
    const unique = Array.from(new Set(numbers))
    if (view.status === "downloading") {
      const active = unique.filter((n) => running.has(n)).map(itemOf)
      return stopMany(active, view.done, view.total)
    }
    if (view.status === "done") {
      return void confirmRemoveMany(name, unique.filter((n) => downloaded.has(n)).map(itemOf))
    }
    const todo = unique.filter((n) => hasPlayableAudio(n) && !downloaded.has(n) && !running.has(n))
    if (!todo.length) return
    if (todo.length > DOWNLOAD_ALL_LIMIT) {
      return useDownloadUiStore.getState().showToast(`Up to ${DOWNLOAD_ALL_LIMIT} songs at a time. Narrow the list with a chip first.`)
    }
    startMany(todo.map(itemOf))
  }, [numbers, view, running, downloaded, name])

  return { view, press }
}
