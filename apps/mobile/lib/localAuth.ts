import { Platform } from "react-native"

import type { AuthSessionPayload } from "@/lib/oauthIdentity"
import { apiBaseUrl } from "@/lib/client"
import { adoptTokenResponse } from "@/lib/memberSession"

async function postAuth(path: "register" | "login", body: Record<string, string | boolean>) {
  const response = await fetch(`${apiBaseUrl}/api/v1/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-device-label": `${Platform.OS} app` },
    body: JSON.stringify(body),
  })
  const payload = (await response.json().catch(() => null)) as { detail?: string } | AuthSessionPayload | null
  if (!response.ok) {
    throw new Error((payload as { detail?: string } | null)?.detail || "Could not complete sign-in.")
  }
  if (!payload || !("client_principal" in payload)) {
    throw new Error("Authentication response was incomplete.")
  }
  // The server sends session tokens with the sign-in answer; keep them in secure storage.
  await adoptTokenResponse(payload)
  return payload
}

export async function registerWithEmail(input: {
  email: string
  password: string
  displayName: string
  /** The "I'm 16 or older" tick of the sign-up form (docs/age-confirmation.md). Sent only when ticked. */
  ageConfirmed?: boolean
}) {
  return postAuth("register", {
    email: input.email,
    password: input.password,
    display_name: input.displayName,
    ...(input.ageConfirmed ? { age_confirmed: true } : {}),
  })
}

export async function loginWithEmail(input: { email: string; password: string }) {
  return postAuth("login", {
    email: input.email,
    password: input.password,
  })
}
