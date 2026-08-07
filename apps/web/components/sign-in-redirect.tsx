"use client"

import { useEffect, useRef } from "react"

import { useMember } from "@/components/member-provider"
import { isAdminDestination } from "@/lib/member-request"
import { signInReturnPath } from "@/lib/sign-in"

async function azurePrincipalPresent() {
  try {
    const response = await fetch("/.auth/me", { credentials: "same-origin", cache: "no-store" })
    if (!response.ok) return false
    const body = await response.json().catch(() => null) as { clientPrincipal?: unknown } | null
    return Boolean(body?.clientPrincipal)
  } catch {
    return false
  }
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
    let active = true
    const timer = window.setTimeout(() => {
      void (async () => {
        await refresh({ silent: true })
        if (!active || leaving.current) return
        // Easy Auth cookie can exist before member session hydrates. If Azure
        // already has a principal, leave /signin so Sign in cannot bounce forever.
        if (await azurePrincipalPresent()) {
          await refresh({ silent: true })
          if (!active || leaving.current) return
          leaving.current = true
          window.location.replace(destination)
        }
      })()
    }, 600)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [adminDestination, destination, isAuthenticated, loading, refresh])

  return null
}
