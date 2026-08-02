"use client"

import { useEffect, useRef } from "react"

import { useMember } from "@/components/member-provider"
import { safeSignInNextPath } from "@/lib/sign-in"

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
  const destination = safeSignInNextPath(next)
  const leaving = useRef(false)

  useEffect(() => {
    if (leaving.current || loading) return
    if (session.authenticated) {
      leaving.current = true
      window.location.replace(destination)
    }
  }, [destination, loading, session.authenticated])

  useEffect(() => {
    if (leaving.current || loading || session.authenticated) return
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
  }, [destination, loading, refresh, session.authenticated])

  return null
}
