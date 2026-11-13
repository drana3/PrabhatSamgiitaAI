import { useEffect } from "react"
import { AppState, InteractionManager, Platform, type AppStateStatus } from "react-native"

import "@/lib/account/ownership"
import { startLearnSync, syncLearnNow } from "@/lib/learn/sync"
import { hydrateLocalMemberEmail } from "@/lib/memberEmail"
import { memberAuthAvailable } from "@/lib/memberAuth"
import {
  ensureFreshAccessToken,
  ensureMemberSessionHydrated,
  memberSessionBaseUrl,
  startMemberSessionKeepAlive,
} from "@/lib/memberSession"
import { refreshMemberSession } from "@/lib/session"
import { useAuthStore } from "@/stores/authStore"

async function syncIfSignedIn() {
  if (useAuthStore.getState().mode !== "signed_in") return
  await hydrateLocalMemberEmail()
  await ensureMemberSessionHydrated()
  await ensureFreshAccessToken(memberSessionBaseUrl())
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
    let unsub: () => void = () => undefined
    let stopKeepAlive: () => void = () => undefined
    let cancelled = false

    const start = () => {
      if (cancelled) return
      void ensureMemberSessionHydrated()
      stopKeepAlive = startMemberSessionKeepAlive(memberSessionBaseUrl())
      unsub = attachSessionSync()
      startLearnSync() // Learn progress between phones: pulls now, pushes after changes (lib/learn/sync.ts)
    }

    if (Platform.OS === "android") {
      const task = InteractionManager.runAfterInteractions(start)
      return () => {
        cancelled = true
        task.cancel()
        unsub()
        stopKeepAlive()
      }
    }

    start()
    return () => {
      cancelled = true
      unsub()
      stopKeepAlive()
    }
  }, [])

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === "active") {
        void syncIfSignedIn()
        void syncLearnNow()
      }
    }
    const sub = AppState.addEventListener("change", onChange)
    return () => sub.remove()
  }, [])

  return null
}
