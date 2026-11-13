import { useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"
import { useFocusEffect } from "expo-router"

import { audioStartedUnderVideo } from "@/lib/recordingVideos/embed"
import { usePlayerStore } from "@/stores/playerStore"

/**
 * Which video of the page is open inside the app, and what that does to the recording's sound (docs/kiirtan-video.md):
 *  - opening a video PAUSES the recording's audio. The queue and the radio are not touched, and nothing resumes by itself;
 *  - if the audio is started while a video is open, the video closes (never two sounds at once);
 *  - a video never plays in the background: it closes when the page loses focus (another screen, the player) or the app
 *    leaves the foreground.
 */
export type VideoWatch = { openId: string | null; open: (id: string) => void; close: () => void }

export function useVideoWatch(): VideoWatch {
  const [openId, setOpenId] = useState<string | null>(null)
  const openRef = useRef<string | null>(null)
  openRef.current = openId

  const open = useCallback((id: string) => {
    usePlayerStore.getState().pause()
    setOpenId(id)
  }, [])
  const close = useCallback(() => setOpenId(null), [])

  useEffect(
    () =>
      usePlayerStore.subscribe((after, before) => {
        if (audioStartedUnderVideo(before, after, openRef.current !== null)) setOpenId(null)
      }),
    [],
  )
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") setOpenId(null)
    })
    return () => sub.remove()
  }, [])
  useFocusEffect(useCallback(() => () => setOpenId(null), []))

  return { openId, open, close }
}
