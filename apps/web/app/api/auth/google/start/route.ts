import { NextRequest, NextResponse } from "next/server"

import {
  pkceChallenge,
  randomOAuthString,
  resolvedGoogleClientId,
  writeGooglePkceCookie,
} from "@/lib/google-oauth-server"
import { safeSignInNextPath } from "@/lib/sign-in"
import { isAllowedWebOAuthRedirect } from "@/lib/site-origin"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    next?: string
    redirect_uri?: string
  } | null

  const clientId = resolvedGoogleClientId()
  const redirectUri = body?.redirect_uri?.trim() ?? ""
  if (!clientId) {
    return NextResponse.json({ detail: "Google sign-in is not configured" }, { status: 503 })
  }
  if (!redirectUri || !isAllowedWebOAuthRedirect(request, redirectUri)) {
    return NextResponse.json({ detail: "Google redirect URI is not allowed" }, { status: 400 })
  }

  const verifier = randomOAuthString(32)
  const state = randomOAuthString(16)
  const next = safeSignInNextPath(body?.next)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile email",
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
    state,
    prompt: "select_account",
  })

  const response = NextResponse.json({
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  })
  writeGooglePkceCookie(response, request, {
    verifier,
    next,
    redirectUri,
    state,
    clientId,
  })
  return response
}
