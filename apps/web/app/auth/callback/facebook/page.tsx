"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { completeFacebookOAuth } from "@/lib/web-oauth"

export default function FacebookAuthCallbackPage() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")
    const oauthError = params.get("error_description") || params.get("error")
    if (oauthError) {
      setError(oauthError)
      return
    }
    if (!code) {
      setError("Facebook sign-in did not return an authorization code.")
      return
    }

    void completeFacebookOAuth(code)
      .then((destination) => {
        window.location.replace(destination)
      })
      .catch((submitError) => {
        setError(submitError instanceof Error ? submitError.message : "Facebook sign-in failed.")
      })
  }, [])

  return (
    <main className="grid min-h-screen place-items-center bg-ivory-50 px-6 text-center">
      <div className="max-w-md">
        {error ? (
          <>
            <p className="eyebrow">Sign-in</p>
            <h1 className="mt-3 font-serif text-3xl text-navy-950">Facebook sign-in could not finish</h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">{error}</p>
            <Link href="/signin" className="gold-button mt-6 inline-flex px-6 py-3">
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="eyebrow">Sign-in</p>
            <h1 className="mt-3 font-serif text-3xl text-navy-950">Completing Facebook sign-in…</h1>
            <p className="mt-3 text-sm text-stone-600">One moment while we connect your member session.</p>
          </>
        )}
      </div>
    </main>
  )
}
