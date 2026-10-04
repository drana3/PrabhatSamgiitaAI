"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

import { useMember } from "@/components/member-provider"
import { hasExplicitSignOut } from "@/lib/explicit-sign-out"
import {
  easyAuthSyncBlockedOnPage,
  syncEasyAuthSessionFromBrowser,
} from "@/lib/easy-auth-client"

function shouldAttemptRecovery(pathname: string) {
  if (pathname === "/signin" || pathname.startsWith("/auth/")) return true
  if (pathname === "/" || pathname.startsWith("/account") || pathname.startsWith("/saved")) return true
  return false
}

/** One-shot: mint ps_member_principal from SWA /.auth/me when the platform cookie exists but the app cookie does not. */
export function AuthSessionRecovery() {
  const pathname = usePathname()
  const { loading, session, refresh } = useMember()
  const attempted = useRef(false)

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_AUTH_ENABLED !== "true") return
    if (attempted.current || loading || session.authenticated) return
    if (hasExplicitSignOut()) return
    if (easyAuthSyncBlockedOnPage()) return
    if (!shouldAttemptRecovery(pathname)) return

    attempted.current = true
    void syncEasyAuthSessionFromBrowser().then((ok) => {
      if (ok) void refresh({ silent: true })
    })
  }, [loading, pathname, refresh, session.authenticated])

  return null
}
