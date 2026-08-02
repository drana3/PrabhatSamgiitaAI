"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"

import { clearSongChatStorage } from "@/lib/chat"
import { fetchMemberSession } from "@/lib/member"
import type { MemberSession } from "@/lib/member"

type MemberContextValue = {
  loading: boolean
  session: MemberSession
  refresh: () => Promise<void>
}

const MemberContext = createContext<MemberContextValue | null>(null)

export function MemberProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<MemberSession>({ authenticated: false })
  const previousAuth = useRef(session.authenticated)

  async function refresh() {
    setLoading(true)
    const next = await fetchMemberSession()
    const signedOut = previousAuth.current && !next.authenticated
    const signedIn = !previousAuth.current && next.authenticated
    if (signedOut || signedIn) {
      clearSongChatStorage()
    }
    previousAuth.current = next.authenticated
    setSession(next)
    setLoading(false)
  }

  useEffect(() => { void refresh() }, [])

  return <MemberContext.Provider value={{ loading, session, refresh }}>{children}</MemberContext.Provider>
}

export function useMember() {
  const value = useContext(MemberContext)
  if (!value) throw new Error("useMember must be used inside MemberProvider")
  return value
}
