"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"
import { completeGoogleOAuth } from "@/lib/web-oauth"

export default function GoogleAuthCallbackPage() {
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState("Confirming with Google…")
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")
    const oauthError = params.get("error_description") || params.get("error")
    if (oauthError) {
      setError(oauthError)
      return
    }
    if (!code) {
      setError("Google sign-in did not return an authorization code.")
      return
    }

    const phaseTimer = window.setTimeout(() => {
      setPhase("Creating your member session…")
    }, 900)

    void completeGoogleOAuth(code)
      .then((destination) => {
        setPhase("Signed in — taking you back…")
        window.location.replace(destination)
      })
      .catch((submitError) => {
        setError(submitError instanceof Error ? submitError.message : "Google sign-in failed.")
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
            <h1 className="mt-3 font-serif text-3xl text-navy-950">Google sign-in could not finish</h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">{error}</p>
            <Link href="/signin" className="gold-button mt-6 inline-flex px-6 py-3">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="eyebrow">Sign-in</p>
            <h1 className="mt-3 font-serif text-3xl text-navy-950">Completing Google sign-in</h1>
            <div className="mt-5 flex justify-center">
              <LoadingIndicator label={phase} />
            </div>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Please keep this page open. Google and member session setup often take a few seconds on mobile.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
