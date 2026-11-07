import { useEffect } from "react"
import { AppState, type AppStateStatus } from "react-native"

import { syncChordNotices } from "@/lib/songChords/noticeSync"
import { useAuthStore } from "@/stores/authStore"
import { useChordNoticeStore } from "@/stores/chordNoticeStore"

/** One look at the member's charts is enough per minute: coming back to the app twice quickly asks the server once. */
const MIN_GAP_MS = 60_000

let lastLook = 0

async function look(): Promise<void> {
  if (useAuthStore.getState().mode !== "signed_in") return
  const now = Date.now()
  if (now - lastLook < MIN_GAP_MS) return
  lastLook = now
  await syncChordNotices()
}

/**
 * Tells the member when the team decided on a chart they offered: on launch and when the app comes back to the
 * foreground it loads "my charts" and turns a status change into an item of the notification centre
 * (lib/songChords/noticeSync.ts). Renders nothing. Needs the saved "last seen" statuses first, so the first look does
 * not announce every old decision again.
 */
export function ChordNoticeSync() {
  useEffect(() => {
    let cancelled = false
    const start = () => {
      if (!cancelled) void look()
    }
    const store = useChordNoticeStore
    const unsub = store.persist.onFinishHydration(start)
    if (store.persist.hasHydrated()) start()
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active" && store.persist.hasHydrated()) void look()
    })
    return () => {
      cancelled = true
      unsub()
      sub.remove()
    }
  }, [])
  return null
}
