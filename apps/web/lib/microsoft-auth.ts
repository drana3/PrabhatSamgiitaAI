"use client"

import { buildClientPrincipal } from "@/lib/azure-principal"
import {
  fetchBrowserEasyAuthPrincipal,
  persistEasyAuthMemberSession,
} from "@/lib/easy-auth-client"
import { normalizeEasyAuthProvider, principalFromEasyAuthMe } from "@/lib/easy-auth"
import { MICROSOFT_NEXT_COOKIE } from "@/lib/member-auth-cookie"
import { microsoftSignInHref, safeSignInNextPath, signInReturnPath } from "@/lib/sign-in"

const MICROSOFT_NEXT_STORAGE_KEY = "ps_oauth_microsoft_next"

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function writeMicrosoftNextCookie(next: string) {
  const path = safeSignInNextPath(next)
  sessionStorage.setItem(MICROSOFT_NEXT_STORAGE_KEY, path)
  try {
    localStorage.setItem(MICROSOFT_NEXT_STORAGE_KEY, path)
  } catch {
    // ignore
  }
  const value = encodeURIComponent(path)
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; secure" : ""
  document.cookie = `${MICROSOFT_NEXT_COOKIE}=${value}; path=/; max-age=900; samesite=lax${secure}`
}

function readMicrosoftNext() {
  return (
    sessionStorage.getItem(MICROSOFT_NEXT_STORAGE_KEY) ||
    localStorage.getItem(MICROSOFT_NEXT_STORAGE_KEY) ||
    "/"
  )
}

function clearMicrosoftNextStorage() {
  sessionStorage.removeItem(MICROSOFT_NEXT_STORAGE_KEY)
  try {
    localStorage.removeItem(MICROSOFT_NEXT_STORAGE_KEY)
  } catch {
    // ignore
  }
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; secure" : ""
  document.cookie = `${MICROSOFT_NEXT_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`
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
  writeMicrosoftNextCookie(next ?? "/")
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

/** Browser fallback when SWA lands on /signin?easyAuth=microsoft instead of the API route. */
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

  clearMicrosoftNextStorage()
  return signInReturnPath(next)
}

export async function completeMicrosoftEasyAuth() {
  return finishMicrosoftEasyAuthFromBrowser()
}
