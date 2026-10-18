import { AppState, type AppStateStatus } from "react-native"

import { flushPlaylistSyncNow } from "@/lib/playlistSyncQueue"

let started = false

export function startPlaylistBackgroundSync() {
  if (started) return
  started = true
  AppState.addEventListener("change", (next: AppStateStatus) => {
    if (next === "background" || next === "inactive") {
      void flushPlaylistSyncNow()
    }
  })
}
