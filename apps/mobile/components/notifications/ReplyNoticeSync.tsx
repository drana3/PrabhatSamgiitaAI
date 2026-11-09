import { useEffect } from "react"
import { AppState, type AppStateStatus } from "react-native"

import { syncClaimNotices } from "@/lib/authors/claimNotices"
import { forgetShownOnPages } from "@/lib/authors/onPages"
import { syncReplyNotices } from "@/lib/comments/replyNotices"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useAuthStore } from "@/stores/authStore"
import { useNotificationsStore } from "@/stores/notificationsStore"

/** Asking twice within a minute asks the server once. */
const MIN_GAP_MS = 60_000
let lastLook = 0

async function look(): Promise<void> {
  if (MOCKUP_DATA || useAuthStore.getState().mode !== "signed_in") return
  const now = Date.now()
  if (now - lastLook < MIN_GAP_MS) return
  lastLook = now
  await syncReplyNotices()
  // claims of author pages: decisions for the page owner, "your recording is on a page" for the uploader
  if ((await syncClaimNotices()) > 0) forgetShownOnPages()
}

/**
 * Brings the replies to the member's comments into the notification centre (lib/comments/replyNotices.ts): on start and
 * whenever the app comes back to the front. Draws nothing. Waits for the saved inbox to load first, so a new item is
 * never written over by the older copy.
 */
export function ReplyNoticeSync() {
  useEffect(() => {
    let cancelled = false
    const start = () => {
      if (!cancelled) void look()
    }
    const store = useNotificationsStore
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
