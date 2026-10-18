"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"

import { useMember } from "@/components/member-provider"
import { finishMicrosoftEasyAuthFromBrowser } from "@/lib/microsoft-auth"

/** SWA returns here after AAD login (relative post_login_redirect_uri). */
export function MicrosoftEasyAuthLanding() {
  const searchParams = useSearchParams()
  const { refresh } = useMember()
  const started = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (searchParams.get("easyAuth") !== "microsoft") return
    if (searchParams.get("signedOut") === "1") return
    if (started.current) return
    started.current = true
    setBusy(true)
    setError(null)

    void finishMicrosoftEasyAuthFromBrowser()
      .then(async (destination) => {
        await refresh({ silent: true })
        window.location.replace(destination)
      })
      .catch((submitError) => {
        started.current = false
        setBusy(false)
        setError(submitError instanceof Error ? submitError.message : "Microsoft sign-in failed.")
      })
  }, [refresh, searchParams])

  if (!busy && !error) return null

  return (
    <div
      className={`mt-6 rounded-xl border px-4 py-3 text-sm leading-6 ${
        error
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-gold-500/25 bg-gold-50 text-navy-950"
      }`}
      role="status"
    >
      {error ?? "Completing Microsoft sign-in… please wait a moment."}
    </div>
  )
}
