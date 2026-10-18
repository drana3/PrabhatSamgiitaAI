import { useEffect } from "react"
import { InteractionManager, Platform } from "react-native"

import { hydrateAudioRepeat } from "@/lib/audioRepeat"
import { setupNativeCatalogPlayer } from "@/lib/playback/nativeCatalogPlayer"
import { usePlayerStore } from "@/stores/playerStore"

/** Native Track Player owns lock-screen audio. JS only boots the queue and hydrates repeat. */
export function PlaybackLifecycle() {
  useEffect(() => {
    const boot = () => {
      void setupNativeCatalogPlayer().catch(() => undefined)
      usePlayerStore.getState().warmAudio()
      void hydrateAudioRepeat().then((enabled) => {
        if (enabled) usePlayerStore.setState({ repeat: true })
      })
    }
    if (Platform.OS === "android") {
      const task = InteractionManager.runAfterInteractions(boot)
      return () => task.cancel()
    }
    boot()
  }, [])

  return null
}
