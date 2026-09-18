import { useEffect } from "react"
import { InteractionManager, Platform } from "react-native"

import { hydrateAudioRepeat } from "@/lib/audioRepeat"
import { usePlayerStore } from "@/stores/playerStore"

/**
 * Keep AVAudioSession warm. Do not pause on background — locking the phone
 * or switching apps must leave the song playing (UIBackgroundModes audio).
 */
export function PlaybackLifecycle() {
  useEffect(() => {
    const boot = () => {
      usePlayerStore.getState().warmAudio()
      void hydrateAudioRepeat().then((enabled) => {
        if (enabled) usePlayerStore.setState({ repeat: true })
      })
    }
    // Android: defer native audio mode until after first paint — avoids a cold-start
    // flash-close when opening from Play immediately after install.
    if (Platform.OS === "android") {
      const task = InteractionManager.runAfterInteractions(boot)
      return () => task.cancel()
    }
    boot()
  }, [])

  return null
}
