"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

import { useMember } from "@/components/member-provider"

const ALLOWED_PREFIXES = ["/complete-profile", "/signin", "/auth/", "/api/"]

export function PhoneRequiredGate({ children }: { children: React.ReactNode }) {
  const { loading, session } = useMember()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (loading || !session.authenticated) return
    if (!("phone_required" in session) || !session.phone_required) return
    if (ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return
    const search = window.location.search
    const next = `${pathname}${search}`
    router.replace(`/complete-profile?next=${encodeURIComponent(next)}`)
  }, [loading, pathname, router, session])

  return children
}
