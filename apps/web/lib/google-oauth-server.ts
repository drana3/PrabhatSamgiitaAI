import { createHash, randomBytes } from "node:crypto"

import { NextResponse } from "next/server"

import { buildClientPrincipal } from "@/lib/azure-principal"
import { googleOAuthClientId, runtimeEnv } from "@/lib/runtime-env"
import { safeSignInNextPath, signInReturnPath } from "@/lib/sign-in"
import { requestIsSecure } from "@/lib/site-origin"

export const GOOGLE_PKCE_COOKIE = "ps_google_pkce"

export type GooglePkceState = {
  verifier: string
  next: string
  redirectUri: string
  state: string
  clientId: string
}

export function resolvedGoogleClientId(requested?: string) {
  const known = [googleOAuthClientId(), runtimeEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID")].filter(
    (value): value is string => Boolean(value),
  )
  if (requested && known.includes(requested)) return requested
  return known[0]
}

export function randomOAuthString(bytes = 32) {
  return randomBytes(bytes).toString("hex")
}

export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url")
}

export function parseGooglePkceCookie(raw?: string | null): GooglePkceState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as GooglePkceState
    if (!parsed.verifier || !parsed.redirectUri || !parsed.state || !parsed.clientId) return null
    return {
      ...parsed,
      next: safeSignInNextPath(parsed.next),
    }
  } catch {
    try {
      const parsed = JSON.parse(decodeURIComponent(raw)) as GooglePkceState
      if (!parsed.verifier || !parsed.redirectUri || !parsed.state || !parsed.clientId) return null
      return {
        ...parsed,
        next: safeSignInNextPath(parsed.next),
      }
    } catch {
      return null
    }
  }
}

export function googlePkceCookieOptions(request: Request, maxAge: number) {
  return {
    httpOnly: true,
    secure: requestIsSecure(request),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}

export function writeGooglePkceCookie(response: NextResponse, request: Request, value: GooglePkceState) {
  response.cookies.set(
    GOOGLE_PKCE_COOKIE,
    JSON.stringify(value),
    googlePkceCookieOptions(request, 600),
  )
}

export function clearGooglePkceCookie(response: NextResponse, request: Request) {
  response.cookies.set(GOOGLE_PKCE_COOKIE, "", googlePkceCookieOptions(request, 0))
}

export async function exchangeGoogleAuthorizationCode(input: {
  clientId: string
  code: string
  redirectUri: string
  verifier: string
}) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    code: input.code,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.verifier,
  })
  const clientSecret = runtimeEnv("GOOGLE_CLIENT_SECRET")
  if (clientSecret) params.set("client_secret", clientSecret)

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store",
  })
  const tokenBody = (await tokenResponse.json().catch(() => null)) as {
    access_token?: string
    error?: string
    error_description?: string
  } | null
  return { ok: tokenResponse.ok, status: tokenResponse.status, tokenBody }
}

export async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })
  if (!response.ok) return null
  return (await response.json().catch(() => null)) as {
    sub?: string
    email?: string
    name?: string
  } | null
}

export function memberCookieFromGoogleProfile(profile: { sub: string; email?: string; name?: string }) {
  return buildClientPrincipal(
    profile.sub,
    profile.name || profile.email || "Google member",
    "google",
    profile.email ?? null,
  )
}

export function googleFinishDestination(next: string) {
  return signInReturnPath(next)
}
