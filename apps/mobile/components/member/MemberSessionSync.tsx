import { useEffect } from "react"
import { AppState, type AppStateStatus } from "react-native"

import { memberAuthAvailable } from "@/lib/memberAuth"
import { refreshMemberSession } from "@/lib/session"
import { useAuthStore } from "@/stores/authStore"

/** Re-fetch member profile (admin, favorites) when the app returns to foreground. */
export function MemberSessionSync() {
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next !== "active") return
      if (useAuthStore.getState().mode !== "signed_in" || !memberAuthAvailable()) return
      void refreshMemberSession()
    }
    const sub = AppState.addEventListener("change", onChange)
    return () => sub.remove()
  }, [])

  return null
}
