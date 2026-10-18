"use client"

import { useEffect, useRef } from "react"

import { useMember } from "@/components/member-provider"
import {
  easyAuthSyncBlockedOnPage,
  startEasyAuthSessionSyncLoop,
  syncEasyAuthSessionFromBrowser,
} from "@/lib/easy-auth-client"
import { webEasyAuthBackgroundSyncEnabled } from "@/lib/web-auth-policy"

export function EasyAuthSessionBootstrap() {
  const { loading, session, refresh } = useMember()
  const authenticatedRef = useRef(session.authenticated)

  authenticatedRef.current = session.authenticated

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_AUTH_ENABLED !== "true") return
    if (!webEasyAuthBackgroundSyncEnabled()) return
    if (easyAuthSyncBlockedOnPage()) return

    return startEasyAuthSessionSyncLoop({
      shouldContinue: () => !authenticatedRef.current,
      onAttempt: async () => {
        if (loading || authenticatedRef.current) return
        const ok = await syncEasyAuthSessionFromBrowser()
        if (ok) await refresh({ silent: true })
      },
    })
  }, [loading, refresh])

  return null
}
