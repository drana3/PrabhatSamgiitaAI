"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import { useMember } from "@/components/member-provider"
import { readFeelingSearchEnabled, writeFeelingSearchEnabled } from "@/lib/feeling-search"
import { signInHref } from "@/lib/sign-in"

export function FeelingSearchToggle({ compact = false }: { compact?: boolean }) {
  const { session } = useMember()
  const signedIn = session.authenticated
  const router = useRouter()
  const pathname = usePathname()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(readFeelingSearchEnabled())
    function onChange() {
      setEnabled(readFeelingSearchEnabled())
    }
    window.addEventListener("storage", onChange)
    window.addEventListener("prabhat-feeling-search", onChange)
    return () => {
      window.removeEventListener("storage", onChange)
      window.removeEventListener("prabhat-feeling-search", onChange)
    }
  }, [])

  function toggle() {
    if (!signedIn) {
      router.push(signInHref(pathname))
      return
    }
    const next = !enabled
    writeFeelingSearchEnabled(next)
    setEnabled(next)
  }

  const active = signedIn && enabled

  return (
    <div className={compact ? "flex items-center justify-between gap-3 pt-2" : "mt-4 flex items-start justify-between gap-3"}>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-navy-950">Feeling search</p>
        <p className="mt-0.5 text-xs leading-5 text-stone-600">
          {signedIn
            ? "When on, mood and sentiment go through meaning search. Lyrics stay local."
            : "Sign in to search songs by feeling."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label="Feeling search"
        onClick={toggle}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${active ? "bg-gold-600" : "bg-navy-900/20"}`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${active ? "left-5" : "left-0.5"}`}
        />
      </button>
    </div>
  )
}
