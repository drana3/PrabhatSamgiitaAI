"use client"

import { useEffect, useRef } from "react"

import { useMember } from "@/components/member-provider"
import { syncEasyAuthSessionFromBrowser, easyAuthSyncBlockedOnPage, startEasyAuthSessionSyncLoop } from "@/lib/easy-auth-client"
import { isAdminDestination } from "@/lib/member-request"
import { signInReturnPath } from "@/lib/sign-in"

function signedOutOnSignInPage() {
  return easyAuthSyncBlockedOnPage()
}

export function SignInRedirect({ next }: { next: string }) {
  const { loading, session, refresh } = useMember()
  const destination = signInReturnPath(next)
  const leaving = useRef(false)
  const authenticatedRef = useRef(session.authenticated)
  authenticatedRef.current = session.authenticated
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

    return startEasyAuthSessionSyncLoop({
      shouldContinue: () => !leaving.current && !signedOutOnSignInPage() && !authenticatedRef.current,
      onAttempt: async () => {
        if (leaving.current || loading || authenticatedRef.current) return
        await syncEasyAuthSessionFromBrowser()
        await refresh({ silent: true })
        if (authenticatedRef.current) {
          leaving.current = true
        }
      },
    })
  }, [adminDestination, isAuthenticated, loading, refresh, session.authenticated])

  return null
}
