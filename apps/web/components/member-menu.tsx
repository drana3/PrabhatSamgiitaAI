"use client"

import Link from "next/link"

import { useMember } from "@/components/member-provider"

export function MemberMenu() {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"
  const { loading, session } = useMember()
  if (!authEnabled) return null
  if (loading) return <span aria-label="Checking sign-in" className="h-10 w-20 animate-pulse rounded-full bg-navy-900/5" />
  if (!session.authenticated) {
    return <Link href="/signin" className="outline-button px-4 py-2.5">Sign in</Link>
  }
  const firstName = session.display_name.trim().split(/\s+/)[0] || "Member"
  return (
    <Link href="/account" className="flex items-center gap-2 rounded-full border border-navy-900/10 bg-white px-3 py-2 text-xs font-semibold text-navy-950">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-gold-100 text-gold-800">{firstName.slice(0, 1).toUpperCase()}</span>
      <span className="hidden sm:inline">Namaskar, {firstName}</span>
    </Link>
  )
}
