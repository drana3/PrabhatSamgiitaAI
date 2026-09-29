"use client"

import { useEffect, useRef } from "react"

import { useMember } from "@/components/member-provider"
import { isAdminDestination } from "@/lib/member-request"
import { signInReturnPath } from "@/lib/sign-in"

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
      void refresh({ silent: true }).then(() => {
        if (!active || leaving.current) return
      })
    }, 600)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [adminDestination, isAuthenticated, loading, refresh])

  return null
}
