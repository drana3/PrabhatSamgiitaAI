"use client"

import { useState } from "react"

import { LoadingIndicator } from "@/components/loading-indicator"
import {
  startFacebookOAuth,
  startGoogleOAuth,
  webFacebookOAuthConfigured,
  webGoogleOAuthConfigured,
} from "@/lib/web-oauth"
import { facebookSignInHref, googleSignInHref } from "@/lib/sign-in"

export function GoogleSignInButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const directOAuth = webGoogleOAuthConfigured()

  const onClick = () => {
    if (!directOAuth || busy) return
    setBusy(true)
    setError(null)
    void startGoogleOAuth(next).catch((submitError) => {
      setBusy(false)
      setError(submitError instanceof Error ? submitError.message : "Google sign-in failed.")
    })
  }

  if (!directOAuth) {
    return (
      <a href={googleSignInHref(next)} className="outline-button justify-center py-3.5">
        Continue with Google
      </a>
    )
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className="outline-button justify-center py-3.5"
      >
        {busy ? <LoadingIndicator label="Opening Google…" compact /> : "Continue with Google"}
      </button>
      {busy ? (
        <p className="text-xs leading-5 text-stone-600">
          Preparing a secure sign-in. This can take a few seconds on mobile.
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  )
}

export function FacebookSignInButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const directOAuth = webFacebookOAuthConfigured()

  const onClick = () => {
    if (!directOAuth || busy) return
    setBusy(true)
    setError(null)
    try {
      startFacebookOAuth(next)
    } catch (submitError) {
      setBusy(false)
      setError(submitError instanceof Error ? submitError.message : "Facebook sign-in failed.")
    }
  }

  if (!directOAuth) {
    return (
      <a href={facebookSignInHref(next)} className="outline-button justify-center py-3.5">
        Continue with Facebook
      </a>
    )
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className="outline-button justify-center py-3.5"
      >
        {busy ? <LoadingIndicator label="Opening Facebook…" compact /> : "Continue with Facebook"}
      </button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  )
}
