import { NextRequest, NextResponse } from "next/server"

import {
  pkceChallenge,
  randomOAuthString,
  resolvedGoogleClientId,
  writeGooglePkceCookie,
} from "@/lib/google-oauth-server"
import { safeSignInNextPath } from "@/lib/sign-in"
import { isAllowedWebOAuthRedirect, publicRedirectUrl, resolvePublicSiteOrigin } from "@/lib/site-origin"

export const dynamic = "force-dynamic"

/** Navigation-based Google start so the PKCE cookie is set via redirect (reliable on SWA). */
export async function GET(request: NextRequest) {
  const clientId = resolvedGoogleClientId()
  if (!clientId) {
    return NextResponse.redirect(publicRedirectUrl(request, "/signin?googleError=not_configured"))
  }

  const origin = resolvePublicSiteOrigin(request)
  const redirectUri = `${origin}/auth/callback/google`
  if (!isAllowedWebOAuthRedirect(request, redirectUri)) {
    return NextResponse.redirect(publicRedirectUrl(request, "/signin?googleError=redirect"))
  }

  const verifier = randomOAuthString(32)
  const state = randomOAuthString(16)
  const next = safeSignInNextPath(request.nextUrl.searchParams.get("next") ?? undefined)
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

  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  writeGooglePkceCookie(response, request, {
    verifier,
    next,
    redirectUri,
    state,
    clientId,
  })
  return response
}
