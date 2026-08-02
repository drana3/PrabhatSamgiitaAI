"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { useMember } from "@/components/member-provider"
import { memberFirstName } from "@/lib/member"
import { clearSongChatStorage } from "@/lib/chat"

export function MemberMenu() {
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"
  const { loading, session, refresh } = useMember()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  if (!authEnabled) return null
  if (loading) return <span aria-label="Checking sign-in" className="h-10 w-20 animate-pulse rounded-full bg-navy-900/5" />
  if (!session.authenticated) {
    return <Link href="/signin" className="outline-button px-4 py-2.5">Sign in</Link>
  }

  const firstName = memberFirstName(session.display_name)

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open account menu"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-full border border-navy-900/10 bg-white px-3 py-2 text-xs font-semibold text-navy-950 transition hover:border-gold-500/40"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gold-100 text-gold-800">{firstName.slice(0, 1).toUpperCase()}</span>
        <span className="hidden sm:inline">Namaskar, {firstName}</span>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-50 mt-2 min-w-[12rem] overflow-hidden rounded-2xl border border-navy-900/10 bg-white py-1 shadow-xl">
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm font-semibold text-navy-950 transition hover:bg-ivory-50"
          >
            Manage profile
          </Link>
          <Link
            href="/quiz"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm font-semibold text-navy-950 transition hover:bg-ivory-50"
          >
            Quiz &amp; certificates
          </Link>
          <a
            href="/.auth/logout?post_logout_redirect_uri=/"
            role="menuitem"
            onClick={() => { clearSongChatStorage(); setOpen(false); void refresh() }}
            className="block px-4 py-3 text-sm font-semibold text-stone-600 transition hover:bg-ivory-50"
          >
            Sign out
          </a>
        </div>
      ) : null}
    </div>
  )
}
