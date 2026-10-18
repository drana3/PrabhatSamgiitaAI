"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"

import { clearGuestChatStorage } from "@/lib/chat"
import { fetchMemberSession } from "@/lib/member"
import type { MemberSession } from "@/lib/member"

type MemberContextValue = {
  loading: boolean
  session: MemberSession
  refresh: (options?: { silent?: boolean }) => Promise<void>
}

const MemberContext = createContext<MemberContextValue | null>(null)

export function MemberProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<MemberSession>({ authenticated: false })
  const previousAuth = useRef(session.authenticated)
  const hasLoaded = useRef(false)

  async function refresh(options?: { silent?: boolean }) {
    const showLoading = !options?.silent && !hasLoaded.current
    if (showLoading) setLoading(true)
    try {
      const next = await fetchMemberSession()
      const signedOut = previousAuth.current && !next.authenticated
      if (signedOut) {
        // Keep member-scoped session cache so the same person can restore after
        // signing back in on this tab; guest cache is always discarded.
        clearGuestChatStorage()
      }
      previousAuth.current = next.authenticated
      setSession(next)
    } finally {
      hasLoaded.current = true
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        void refresh({ silent: hasLoaded.current })
      }
    }
    window.addEventListener("focus", onVisible)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("focus", onVisible)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  return <MemberContext.Provider value={{ loading, session, refresh }}>{children}</MemberContext.Provider>
}

export function useMember() {
  const value = useContext(MemberContext)
  if (!value) throw new Error("useMember must be used inside MemberProvider")
  return value
}
