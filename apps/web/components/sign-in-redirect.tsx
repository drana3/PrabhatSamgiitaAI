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
    const timers = [400, 1200, 2500].map((delay) => window.setTimeout(() => { void refresh() }, delay))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [loading, refresh, session.authenticated])

  if (!loading) return null

  return (
    <p role="status" className="mt-4 text-center text-sm text-stone-600">
      Checking your sign-in…
    </p>
  )
}
