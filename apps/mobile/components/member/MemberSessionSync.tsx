import { useEffect } from "react"
import { AppState, type AppStateStatus } from "react-native"

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

/** Pull website member data (admin, favorites) on launch and when returning to foreground. */
export function MemberSessionSync() {
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      void syncIfSignedIn()
    })
    if (useAuthStore.persist.hasHydrated()) void syncIfSignedIn()

    const onChange = (next: AppStateStatus) => {
      if (next === "active") void syncIfSignedIn()
    }
    const sub = AppState.addEventListener("change", onChange)
    return () => {
      unsub()
      sub.remove()
    }
  }, [])

  return null
}
