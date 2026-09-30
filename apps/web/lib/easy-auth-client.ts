"use client"

import type { EasyAuthClientPrincipal } from "@/lib/easy-auth"
import { parseEasyAuthMePayload } from "@/lib/easy-auth"

export function easyAuthSyncBlockedOnPage() {
  if (typeof window === "undefined") return true
  return new URLSearchParams(window.location.search).get("signedOut") === "1"
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

/** SWA serves /.auth/me on the edge; the Next server cannot reliably fetch it. */
export async function syncEasyAuthSessionFromBrowser(): Promise<boolean> {
  const clientPrincipal = await fetchBrowserEasyAuthPrincipal()
  try {
    const response = await fetch("/api/auth/easy-auth-sync", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: clientPrincipal ? { "Content-Type": "application/json" } : undefined,
      body: clientPrincipal ? JSON.stringify({ clientPrincipal }) : undefined,
    })
    return response.ok
  } catch {
    return false
  }
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
