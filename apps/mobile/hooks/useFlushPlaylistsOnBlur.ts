import { useCallback } from "react"
import { useFocusEffect } from "expo-router"

import { usePlaylistStore } from "@/stores/playlistStore"

/** Push pending playlist edits to the server when leaving a playlist-related screen. */
export function useFlushPlaylistsOnBlur() {
  useFocusEffect(
    useCallback(() => {
      return () => {
        void usePlaylistStore.getState().flushSync()
      }
    }, []),
  )
}
