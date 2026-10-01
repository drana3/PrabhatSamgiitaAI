"use client"

import { buildClientPrincipal } from "@/lib/azure-principal"
import {
  fetchBrowserEasyAuthPrincipal,
  persistEasyAuthMemberSession,
} from "@/lib/easy-auth-client"
import { normalizeEasyAuthProvider, principalFromEasyAuthMe } from "@/lib/easy-auth"
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

function memberBlobFromEasyAuthPrincipal(
  clientPrincipal: NonNullable<Awaited<ReturnType<typeof fetchBrowserEasyAuthPrincipal>>>,
) {
  const blob = principalFromEasyAuthMe(clientPrincipal)
  if (blob) return blob

  const userId = clientPrincipal.userId?.trim()
  if (!userId) return null
  const provider = normalizeEasyAuthProvider(clientPrincipal.identityProvider)
  const details = clientPrincipal.userDetails?.trim() || null
  const email = details?.includes("@") ? details : null
  const displayName = details || email || "Prabhat Samgiita member"
  return buildClientPrincipal(userId, displayName, provider, email)
}

export function startMicrosoftEasyAuth(next: string | undefined) {
  storeMicrosoftNext(safeSignInNextPath(next))
  window.location.assign(microsoftSignInHref())
}

async function waitForEasyAuthPrincipal() {
  let clientPrincipal = await fetchBrowserEasyAuthPrincipal()
  for (let attempt = 0; attempt < 20 && !clientPrincipal; attempt += 1) {
    await sleep(400)
    clientPrincipal = await fetchBrowserEasyAuthPrincipal()
  }
  return clientPrincipal
}

/** Called on /signin?easyAuth=microsoft after SWA AAD login. */
export async function finishMicrosoftEasyAuthFromBrowser(): Promise<string> {
  const next = readMicrosoftNext()

  const clientPrincipal = await waitForEasyAuthPrincipal()
  if (!clientPrincipal?.userId) {
    throw new Error("Microsoft signed you in, but this site could not read the session. Please try again.")
  }

  const blob = memberBlobFromEasyAuthPrincipal(clientPrincipal)
  if (!blob) {
    throw new Error("Microsoft signed you in, but this site could not read your profile. Please try again.")
  }

  const ok = await persistEasyAuthMemberSession(clientPrincipal, blob)
  if (!ok) {
    throw new Error("Microsoft signed you in, but this site could not create your member session. Please try again.")
  }

  clearMicrosoftNext()
  return signInReturnPath(next)
}

/** Legacy callback route — same finish path. */
export async function completeMicrosoftEasyAuth() {
  return finishMicrosoftEasyAuthFromBrowser()
}
