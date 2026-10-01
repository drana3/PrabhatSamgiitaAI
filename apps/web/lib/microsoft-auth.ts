"use client"

import { principalFromEasyAuthMe } from "@/lib/easy-auth"
import { fetchBrowserEasyAuthPrincipal } from "@/lib/easy-auth-client"
import { microsoftSignInHref, safeSignInNextPath, signInReturnPath } from "@/lib/sign-in"
import { establishWebSession } from "@/lib/web-oauth"

const MICROSOFT_NEXT_KEY = "ps_oauth_microsoft_next"

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function startMicrosoftEasyAuth(next: string | undefined) {
  sessionStorage.setItem(MICROSOFT_NEXT_KEY, safeSignInNextPath(next))
  window.location.assign(microsoftSignInHref(next))
}

export async function completeMicrosoftEasyAuth() {
  const next = sessionStorage.getItem(MICROSOFT_NEXT_KEY) ?? "/"
  sessionStorage.removeItem(MICROSOFT_NEXT_KEY)

  let clientPrincipal = await fetchBrowserEasyAuthPrincipal()
  for (let attempt = 0; attempt < 8 && !clientPrincipal; attempt += 1) {
    await sleep(400)
    clientPrincipal = await fetchBrowserEasyAuthPrincipal()
  }

  const blob = principalFromEasyAuthMe(clientPrincipal)
  if (!blob || !clientPrincipal?.userId) {
    throw new Error("Microsoft signed you in, but this site could not read the session. Please try again.")
  }

  const details = clientPrincipal.userDetails?.trim() || null
  const email = details?.includes("@") ? details : null
  await establishWebSession({
    provider: "aad",
    subject: clientPrincipal.userId,
    email,
    displayName: details || email || "Prabhat Samgiita member",
  })

  return signInReturnPath(next)
}
