"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  HARMONIUM_PRACTICE_HINT_GUEST,
  HARMONIUM_PRACTICE_HINT_SIGNED_IN,
} from "@prabhat/core"

import { useMember } from "@/components/member-provider"
import {
  readHarmoniumPracticeEnabled,
  writeHarmoniumPracticeEnabled,
} from "@/lib/harmonium-practice-pref"
import { signInHref } from "@/lib/sign-in"

export function HarmoniumPracticeToggle({ compact = false }: { compact?: boolean }) {
  const { session } = useMember()
  const signedIn = session.authenticated
  const router = useRouter()
  const pathname = usePathname()
  const [enabled, setEnabled] = useState(() =>
    typeof window === "undefined" ? false : readHarmoniumPracticeEnabled(),
  )

  useEffect(() => {
    setEnabled(readHarmoniumPracticeEnabled())
    function onChange() {
      setEnabled(readHarmoniumPracticeEnabled())
    }
    window.addEventListener("storage", onChange)
    window.addEventListener("prabhat-harmonium-practice", onChange)
    return () => {
      window.removeEventListener("storage", onChange)
      window.removeEventListener("prabhat-harmonium-practice", onChange)
    }
  }, [])

  function toggle() {
    if (!signedIn) {
      router.push(signInHref(pathname))
      return
    }
    const next = !enabled
    writeHarmoniumPracticeEnabled(next)
    setEnabled(next)
  }

  const active = signedIn && enabled

  return (
    <div className={compact ? "flex items-center justify-between gap-3 pt-2" : "mt-4 flex items-start justify-between gap-3"}>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-navy-950">Harmonium practice</p>
        <p className="mt-0.5 text-xs leading-5 text-stone-600">
          {signedIn ? HARMONIUM_PRACTICE_HINT_SIGNED_IN : HARMONIUM_PRACTICE_HINT_GUEST}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label="Harmonium practice"
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
