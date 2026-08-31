import { useEffect } from "react"

import { hydrateAudioRepeat } from "@/lib/audioRepeat"
import { usePlayerStore } from "@/stores/playerStore"

/**
 * Keep AVAudioSession warm. Do not pause on background — locking the phone
 * or switching apps must leave the song playing (UIBackgroundModes audio).
 */
export function PlaybackLifecycle() {
  useEffect(() => {
    void hydrateAudioRepeat().then((repeat) => {
      if (repeat) usePlayerStore.setState({ repeat })
    })
    usePlayerStore.getState().warmAudio()
  }, [])

  return null
}
