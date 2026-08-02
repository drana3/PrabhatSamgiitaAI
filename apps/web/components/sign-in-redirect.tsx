"use client"

import { useEffect } from "react"

import { useMember } from "@/components/member-provider"
import { safeSignInNextPath } from "@/lib/sign-in"

export function SignInRedirect({ next }: { next: string }) {
  const { loading, session, refresh } = useMember()
  const destination = safeSignInNextPath(next)

  useEffect(() => {
    if (!loading && session.authenticated) {
      window.location.replace(destination)
    }
  }, [destination, loading, session.authenticated])

  useEffect(() => {
    if (loading || session.authenticated) return
    const timer = window.setTimeout(() => { void refresh({ silent: true }) }, 800)
    return () => window.clearTimeout(timer)
  }, [loading, refresh, session.authenticated])

  return null
}
