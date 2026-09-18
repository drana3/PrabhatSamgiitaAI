import { useEffect } from "react"
import { AppState, InteractionManager, Platform, type AppStateStatus } from "react-native"

import { hydrateLocalMemberEmail } from "@/lib/memberEmail"
import { memberAuthAvailable } from "@/lib/memberAuth"
import { refreshMemberSession } from "@/lib/session"
import { useAuthStore } from "@/stores/authStore"

async function syncIfSignedIn() {
  if (useAuthStore.getState().mode !== "signed_in") return
  await hydrateLocalMemberEmail()
  if (!memberAuthAvailable()) return
  await refreshMemberSession()
}

function attachSessionSync() {
  const unsub = useAuthStore.persist.onFinishHydration(() => {
    void syncIfSignedIn()
  })
  if (useAuthStore.persist.hasHydrated()) void syncIfSignedIn()
  return unsub
}

/** Pull website member data (admin, favorites) on launch and when returning to foreground. */
export function MemberSessionSync() {
  useEffect(() => {
    let unsub = () => undefined
    let cancelled = false

    const start = () => {
      if (cancelled) return
      unsub = attachSessionSync()
    }

    if (Platform.OS === "android") {
      const task = InteractionManager.runAfterInteractions(start)
      return () => {
        cancelled = true
        task.cancel()
        unsub()
      }
    }

    start()
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === "active") void syncIfSignedIn()
    }
    const sub = AppState.addEventListener("change", onChange)
    return () => sub.remove()
  }, [])

  return null
}
