"use client"

import { useEffect, useRef } from "react"

import { useMember } from "@/components/member-provider"
import { syncEasyAuthSessionFromBrowser } from "@/lib/easy-auth-client"
import { isAdminDestination } from "@/lib/member-request"
import { signInReturnPath } from "@/lib/sign-in"

function signedOutOnSignInPage() {
  if (typeof window === "undefined") return false
  return new URLSearchParams(window.location.search).get("signedOut") === "1"
}

export function SignInRedirect({ next }: { next: string }) {
  const { loading, session, refresh } = useMember()
  const destination = signInReturnPath(next)
  const leaving = useRef(false)
  const adminDestination = isAdminDestination(destination)

  const isAuthenticated = session.authenticated
  const isAdmin = isAuthenticated ? session.is_admin : false

  useEffect(() => {
    if (leaving.current || loading) return
    if (!isAuthenticated) return
    if (adminDestination && !isAdmin) return
    leaving.current = true
    window.location.replace(destination)
  }, [adminDestination, destination, isAdmin, isAuthenticated, loading])

  useEffect(() => {
    if (leaving.current || loading || isAuthenticated) return
    if (adminDestination) return
    if (signedOutOnSignInPage()) return

    let active = true
    let attempt = 0

    const tick = async () => {
      if (!active || leaving.current || signedOutOnSignInPage()) return
      await syncEasyAuthSessionFromBrowser()
      await refresh({ silent: true })
    }

    void tick()
    const timer = window.setInterval(() => {
      attempt += 1
      if (attempt >= 20) {
        window.clearInterval(timer)
        return
      }
      void tick()
    }, 500)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [adminDestination, isAuthenticated, loading, refresh])

  return null
}
