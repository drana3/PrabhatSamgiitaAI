"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"
import { completeMicrosoftEasyAuth } from "@/lib/microsoft-auth"

export default function MicrosoftAuthCallbackPage() {
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState("Confirming with Microsoft…")
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const oauthError = new URLSearchParams(window.location.search).get("error_description")
      || new URLSearchParams(window.location.search).get("error")
    if (oauthError) {
      setError(oauthError)
      return
    }

    const phaseTimer = window.setTimeout(() => {
      setPhase("Creating your member session…")
    }, 900)

    void completeMicrosoftEasyAuth()
      .then((destination) => {
        setPhase("Signed in — taking you back…")
        window.location.replace(destination)
      })
      .catch((submitError) => {
        setError(submitError instanceof Error ? submitError.message : "Microsoft sign-in failed.")
      })
      .finally(() => {
        window.clearTimeout(phaseTimer)
      })
  }, [])

  return (
    <main className="grid min-h-screen place-items-center bg-ivory-50 px-6 text-center">
      <div className="max-w-md">
        {error ? (
          <>
            <p className="eyebrow">Sign-in</p>
            <h1 className="mt-3 font-serif text-3xl text-navy-950">Microsoft sign-in could not finish</h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">{error}</p>
            <Link href="/signin" className="gold-button mt-6 inline-flex px-6 py-3">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="eyebrow">Sign-in</p>
            <h1 className="mt-3 font-serif text-3xl text-navy-950">Completing Microsoft sign-in</h1>
            <div className="mt-5 flex justify-center">
              <LoadingIndicator label={phase} />
            </div>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Please keep this page open while we read your Microsoft session and create your member account.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
