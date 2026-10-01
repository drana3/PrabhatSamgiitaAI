"use client"

import type { EasyAuthClientPrincipal } from "@/lib/easy-auth"
import {
  normalizeEasyAuthProvider,
  parseEasyAuthMePayload,
  principalFromEasyAuthMe,
} from "@/lib/easy-auth"
import { hasExplicitSignOut } from "@/lib/explicit-sign-out"
import { webFacebookOAuthConfigured, webGoogleOAuthConfigured } from "@/lib/web-oauth"

export function easyAuthSyncBlockedOnPage() {
  if (typeof window === "undefined") return true
  if (hasExplicitSignOut()) return true
  const path = window.location.pathname
  if (path.startsWith("/auth/") || path.startsWith("/api/auth/")) return true
  return new URLSearchParams(window.location.search).get("signedOut") === "1"
}

async function hasLocalMemberSession() {
  try {
    const response = await fetch("/api/member/session", {
      credentials: "same-origin",
      cache: "no-store",
    })
    if (!response.ok) return false
    const body = (await response.json()) as { authenticated?: boolean }
    return body.authenticated === true
  } catch {
    return false
  }
}

function shouldAutoSyncSwaPrincipal(clientPrincipal: EasyAuthClientPrincipal) {
  const provider = normalizeEasyAuthProvider(clientPrincipal.identityProvider)
  if (provider === "aad") return true
  if (provider === "google" && !webGoogleOAuthConfigured()) return true
  if (provider === "facebook" && !webFacebookOAuthConfigured()) return true
  return false
}

export async function fetchBrowserEasyAuthPrincipal(): Promise<EasyAuthClientPrincipal | null> {
  try {
    const response = await fetch("/.auth/me", {
      credentials: "same-origin",
      cache: "no-store",
    })
    if (!response.ok) return null
    const body = await response.json().catch(() => null)
    return parseEasyAuthMePayload(body)
  } catch {
    return null
  }
}

/** Mint ps_member cookie from a browser-read SWA principal (sync, then principal fallback). */
export async function persistEasyAuthMemberSession(
  clientPrincipal: EasyAuthClientPrincipal,
  principalBlob?: string | null,
): Promise<boolean> {
  const blob = principalBlob ?? principalFromEasyAuthMe(clientPrincipal)
  if (!blob) return false
  const provider = normalizeEasyAuthProvider(clientPrincipal.identityProvider)

  try {
    const syncResponse = await fetch("/api/auth/easy-auth-sync", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientPrincipal }),
    })
    if (syncResponse.ok) return true
  } catch {
    // Fall through — Next on SWA often never sees StaticWebAppsAuthCookie.
  }

  try {
    const response = await fetch("/api/auth/principal", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_principal: blob,
        identity_provider: provider,
      }),
    })
    return response.ok
  } catch {
    return false
  }
}

/** SWA serves /.auth/me on the edge; the Next server cannot reliably fetch it. */
export async function syncEasyAuthSessionFromBrowser(): Promise<boolean> {
  if (await hasLocalMemberSession()) return true

  const clientPrincipal = await fetchBrowserEasyAuthPrincipal()
  if (!clientPrincipal || !shouldAutoSyncSwaPrincipal(clientPrincipal)) return false
  return persistEasyAuthMemberSession(clientPrincipal)
}

export function startEasyAuthSessionSyncLoop(options: {
  shouldContinue: () => boolean
  onAttempt?: () => void | Promise<void>
  maxAttempts?: number
  intervalMs?: number
}) {
  const maxAttempts = options.maxAttempts ?? 20
  const intervalMs = options.intervalMs ?? 500
  let active = true
  let attempt = 0

  const tick = () => {
    if (!active || !options.shouldContinue()) return
    void Promise.resolve(options.onAttempt?.()).catch(() => undefined)
  }

  tick()
  const timer = window.setInterval(() => {
    attempt += 1
    if (attempt >= maxAttempts || !options.shouldContinue()) {
      window.clearInterval(timer)
      return
    }
    tick()
  }, intervalMs)

  return () => {
    active = false
    window.clearInterval(timer)
  }
}
