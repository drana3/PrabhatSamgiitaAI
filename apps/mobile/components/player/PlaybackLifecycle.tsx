import { useEffect } from "react"

import { usePlayerStore } from "@/stores/playerStore"

/**
 * Keep AVAudioSession warm. Do not pause on background — locking the phone
 * or switching apps must leave the song playing (UIBackgroundModes audio).
 */
export function PlaybackLifecycle() {
  useEffect(() => {
    usePlayerStore.getState().warmAudio()
  }, [])

  return null
}
