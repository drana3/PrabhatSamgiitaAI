"use client"

import {
  fetchBrowserEasyAuthPrincipal,
  persistEasyAuthMemberSession,
} from "@/lib/easy-auth-client"
import { microsoftSignInHref, safeSignInNextPath, signInReturnPath } from "@/lib/sign-in"

const MICROSOFT_NEXT_KEY = "ps_oauth_microsoft_next"

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function storeMicrosoftNext(next: string) {
  sessionStorage.setItem(MICROSOFT_NEXT_KEY, next)
  try {
    localStorage.setItem(MICROSOFT_NEXT_KEY, next)
  } catch {
    // ignore private mode
  }
}

function readMicrosoftNext() {
  return (
    sessionStorage.getItem(MICROSOFT_NEXT_KEY) ||
    localStorage.getItem(MICROSOFT_NEXT_KEY) ||
    "/"
  )
}

function clearMicrosoftNext() {
  sessionStorage.removeItem(MICROSOFT_NEXT_KEY)
  try {
    localStorage.removeItem(MICROSOFT_NEXT_KEY)
  } catch {
    // ignore
  }
}

export function startMicrosoftEasyAuth(next: string | undefined) {
  storeMicrosoftNext(safeSignInNextPath(next))
  const origin = typeof window !== "undefined" ? window.location.origin : undefined
  window.location.assign(microsoftSignInHref(origin))
}

export async function completeMicrosoftEasyAuth() {
  const next = readMicrosoftNext()
  clearMicrosoftNext()

  let clientPrincipal = await fetchBrowserEasyAuthPrincipal()
  for (let attempt = 0; attempt < 12 && !clientPrincipal; attempt += 1) {
    await sleep(500)
    clientPrincipal = await fetchBrowserEasyAuthPrincipal()
  }

  if (!clientPrincipal?.userId) {
    throw new Error("Microsoft signed you in, but this site could not read the session. Please try again.")
  }

  const ok = await persistEasyAuthMemberSession(clientPrincipal)
  if (!ok) {
    throw new Error("Microsoft signed you in, but this site could not create your member session. Please try again.")
  }

  return signInReturnPath(next)
}
