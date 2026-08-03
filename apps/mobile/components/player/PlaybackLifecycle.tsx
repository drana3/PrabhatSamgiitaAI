import { useEffect } from "react"
import { AppState, type AppStateStatus } from "react-native"

import { usePlayerStore } from "@/stores/playerStore"

/**
 * Pause when the app is backgrounded so audio does not keep playing after
 * the simulator/app is closed.
 *
 * Important: do NOT pause on `inactive` — iOS fires that during the app
 * switcher and brief transitions, which was cancelling Play on the song page
 * right after returning from Home / multitasking.
 */
export function PlaybackLifecycle() {
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === "background") {
        usePlayerStore.getState().pause()
      }
    }
    const sub = AppState.addEventListener("change", onChange)
    return () => {
      sub.remove()
    }
  }, [])

  return null
}
