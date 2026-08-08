"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"

import { useMember } from "@/components/member-provider"

const ALLOWED_PREFIXES = ["/complete-profile", "/signin", "/auth/", "/api/"]

export function PhoneRequiredGate({ children }: { children: React.ReactNode }) {
  const { loading, session } = useMember()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (loading || !session.authenticated) return
    if (!("phone_required" in session) || !session.phone_required) return
    if (ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return
    const next = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
    router.replace(`/complete-profile?next=${encodeURIComponent(next)}`)
  }, [loading, pathname, router, searchParams, session])

  return children
}
