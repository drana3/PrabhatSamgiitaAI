"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"
import { useMember } from "@/components/member-provider"
import { finishMicrosoftEasyAuthFromBrowser } from "@/lib/microsoft-auth"

export default function MicrosoftAuthCallbackPage() {
  const { refresh } = useMember()
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState("Confirming with Microsoft…")
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const phaseTimer = window.setTimeout(() => {
      setPhase("Creating your member session…")
    }, 900)

    void finishMicrosoftEasyAuthFromBrowser()
      .then(async (destination) => {
        setPhase("Signed in — taking you back…")
        await refresh({ silent: true })
        window.location.replace(destination)
      })
      .catch((submitError) => {
        started.current = false
        setError(submitError instanceof Error ? submitError.message : "Microsoft sign-in failed.")
      })
      .finally(() => {
        window.clearTimeout(phaseTimer)
      })
  }, [refresh])

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
              Please keep this page open. Microsoft and member session setup often take a few seconds.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
