import { useCallback } from "react"
import { useFocusEffect } from "expo-router"

import { usePlayerStore } from "@/stores/playerStore"

/** End drive mode when leaving the Drive screen (stops playback). */
export function useExitDriveOnBlur() {
  useFocusEffect(
    useCallback(() => {
      const store = usePlayerStore.getState()
      store.setDriveScreenFocused(true)
      return () => {
        usePlayerStore.getState().scheduleDriveBlurExit()
      }
    }, []),
  )
}
