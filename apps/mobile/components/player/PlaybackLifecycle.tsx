import { useEffect } from "react"
import { AppState, InteractionManager, Platform } from "react-native"

import { hydrateAudioRepeat } from "@/lib/audioRepeat"
import { setRemoteNextEnabled, setupNativeCatalogPlayer } from "@/lib/playback/nativeCatalogPlayer"
import { startPlayerV2Services } from "@/lib/playerV2/services"
import { canSkipNext } from "@/lib/playerV2/transport"
import { usePlayerStore } from "@/stores/playerStore"
import { usePlayerV2Store } from "@/stores/playerV2Store"

/**
 * Native Track Player owns lock-screen audio. JS boots the queue, hydrates repeat, keeps the UI in
 * step with the sound when the app returns to the front, and keeps the lock-screen Next button
 * honest. The player services (end of track, resume, repeat, sleep timer) run from here for the life
 * of the app, whichever screen opened first.
 */
export function PlaybackLifecycle() {
  useEffect(() => {
    const boot = () => {
      startPlayerV2Services()
      void setupNativeCatalogPlayer().catch(() => undefined)
      usePlayerStore.getState().warmAudio()
      void hydrateAudioRepeat().then((enabled) => {
        if (enabled) usePlayerStore.setState({ repeat: true })
      })
    }
    let task: { cancel: () => void } | null = null
    if (Platform.OS === "android") task = InteractionManager.runAfterInteractions(boot)
    else boot()

    // The JS side can miss events while it is suspended (a pause from the lock screen, a call).
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") usePlayerStore.getState().reconcileForegroundCatalogPlayback()
    })

    // Lock screen / notification: offer Next only when there is a next song.
    const syncNext = () => void setRemoteNextEnabled(canSkipNext()).catch(() => undefined)
    const unsubPlayer = usePlayerStore.subscribe((state, prev) => {
      if (
        state.currentSong?.number !== prev.currentSong?.number ||
        state.queue !== prev.queue ||
        state.playbackMode !== prev.playbackMode ||
        state.playlistBounds !== prev.playlistBounds
      ) {
        syncNext()
      }
    })
    const unsubV2 = usePlayerV2Store.subscribe((state, prev) => {
      if (state.repeatMode !== prev.repeatMode) syncNext()
    })

    return () => {
      task?.cancel()
      appState.remove()
      unsubPlayer()
      unsubV2()
    }
  }, [])

  return null
}
