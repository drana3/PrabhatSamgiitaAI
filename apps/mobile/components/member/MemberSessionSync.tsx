import { useEffect } from "react"
import { AppState, type AppStateStatus } from "react-native"

import { memberAuthAvailable } from "@/lib/memberAuth"
import { refreshMemberSession } from "@/lib/session"
import { useAuthStore } from "@/stores/authStore"

function syncIfSignedIn() {
  if (useAuthStore.getState().mode !== "signed_in" || !memberAuthAvailable()) return
  void refreshMemberSession()
}

/** Pull website member data (admin, favorites) on launch and when returning to foreground. */
export function MemberSessionSync() {
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(syncIfSignedIn)
    if (useAuthStore.persist.hasHydrated()) syncIfSignedIn()

    const onChange = (next: AppStateStatus) => {
      if (next === "active") syncIfSignedIn()
    }
    const sub = AppState.addEventListener("change", onChange)
    return () => {
      unsub()
      sub.remove()
    }
  }, [])

  return null
}
