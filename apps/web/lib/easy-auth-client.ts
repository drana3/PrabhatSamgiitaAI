"use client"

import type { EasyAuthClientPrincipal } from "@/lib/easy-auth"

export async function fetchBrowserEasyAuthPrincipal(): Promise<EasyAuthClientPrincipal | null> {
  try {
    const response = await fetch("/.auth/me", {
      credentials: "same-origin",
      cache: "no-store",
    })
    if (!response.ok) return null
    const body = (await response.json().catch(() => null)) as {
      clientPrincipal?: EasyAuthClientPrincipal | null
    } | null
    return body?.clientPrincipal ?? null
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
