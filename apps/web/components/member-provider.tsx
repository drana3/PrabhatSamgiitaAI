"use client"

import { createContext, useContext, useEffect, useState } from "react"

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

  async function refresh() {
    setLoading(true)
    setSession(await fetchMemberSession())
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
