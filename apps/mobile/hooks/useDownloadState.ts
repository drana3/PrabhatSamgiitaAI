import { useCallback, useMemo } from "react"
import { useShallow } from "zustand/react/shallow"

import { demoDownloadState, downloadView, type DownloadItem, type DownloadView } from "@/lib/offline/downloadModel"
import { isSignedIn, itemAudioUrl, itemHasAudio, pressDownload, useDownloadQueue } from "@/lib/offline/downloadActions"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { offlineRecordingState, useOfflineAudioStore } from "@/lib/offlineAudio"
import { useDemoDownloads } from "@/lib/playerV2/demoDownloads"
import { useAuthStore } from "@/stores/authStore"

const NONE = { downloaded: false, downloading: false, progress: 0 } as const

/**
 * The state of the one download control for a song, a version of a song or a Kiirtan, and what a
 * tap does (like hooks/useSaveState.ts for the save circle-plus). Subscribes to primitives only,
 * so a control re-renders when its own answer changes.
 *
 *   view.visible false -> draw nothing (no playable audio)
 *   press()            -> start, cancel or (after a confirm) remove, by the state
 */
export function useDownloadState(item: DownloadItem | null): {
  view: DownloadView
  /** false for a signed-out listener: the Versions pill says "Sign in to download" */
  signedIn: boolean
  press: () => void
} {
  const number = item?.number ?? 0
  const versionIndex = item?.versionIndex
  const url = item ? itemAudioUrl(item) : ""
  const hasAudio = item ? itemHasAudio(item) : false

  const real = useOfflineAudioStore(
    useShallow((s) => {
      if (MOCKUP_DATA || !item) return NONE
      const state = offlineRecordingState(url || null, s, { songNumber: number })
      return { downloaded: state.downloaded, downloading: state.downloading, progress: state.progress ?? 0 }
    }),
  )
  const demo = useDemoDownloads(
    useShallow((d) => {
      if (!MOCKUP_DATA || !item) return NONE
      const state = demoDownloadState(number, versionIndex, d.done, d.progress)
      return { downloaded: state.downloaded, downloading: state.downloading, progress: state.progress ?? 0 }
    }),
  )
  const queued = useDownloadQueue((s) => (item ? s.pending.some((p) => p.number === number) : false))
  const authMode = useAuthStore((s) => s.mode)

  const source = MOCKUP_DATA ? demo : real
  const view = useMemo(
    () => downloadView({ hasAudio, downloaded: source.downloaded, downloading: source.downloading || queued, progress: source.progress }),
    [hasAudio, source.downloaded, source.downloading, source.progress, queued],
  )
  const press = useCallback(() => {
    if (item) pressDownload(item, view.status)
  }, [item, view.status])
  // authMode is read so the pill follows a sign-in; the preview answers from its own switch
  const signedIn = MOCKUP_DATA ? isSignedIn() : authMode === "signed_in"
  return { view, signedIn, press }
}
