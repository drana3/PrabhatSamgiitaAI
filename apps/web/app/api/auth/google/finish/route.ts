import { NextRequest, NextResponse } from "next/server"

import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import {
  GOOGLE_PKCE_COOKIE,
  clearGooglePkceCookie,
  exchangeGoogleAuthorizationCode,
  fetchGoogleProfile,
  googleFinishDestination,
  memberCookieFromGoogleProfile,
  parseGooglePkceCookie,
} from "@/lib/google-oauth-server"
import { memberAuthCookieOptions } from "@/lib/oauth-return-cookie"
import { requestIsSecure } from "@/lib/site-origin"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    code?: string
    state?: string
  } | null

  const pkce = parseGooglePkceCookie(request.cookies.get(GOOGLE_PKCE_COOKIE)?.value)
  if (!pkce) {
    return NextResponse.json({ detail: "Google sign-in expired. Please try again." }, { status: 400 })
  }
  if (!body?.code) {
    return NextResponse.json({ detail: "Google sign-in payload was incomplete" }, { status: 400 })
  }
  if (body.state && body.state !== pkce.state) {
    return NextResponse.json({ detail: "Google sign-in could not be verified. Please try again." }, { status: 400 })
  }

  const { ok, tokenBody } = await exchangeGoogleAuthorizationCode({
    clientId: pkce.clientId,
    code: body.code,
    redirectUri: pkce.redirectUri,
    verifier: pkce.verifier,
  })
  if (!ok || !tokenBody?.access_token) {
    const response = NextResponse.json(
      {
        detail:
          tokenBody?.error_description ||
          tokenBody?.error ||
          "Google sign-in did not complete.",
      },
      { status: 400 },
    )
    clearGooglePkceCookie(response, request)
    return response
  }

  const profile = await fetchGoogleProfile(tokenBody.access_token)
  if (!profile?.sub) {
    const response = NextResponse.json({ detail: "Could not read your Google profile." }, { status: 400 })
    clearGooglePkceCookie(response, request)
    return response
  }

  const principal = memberCookieFromGoogleProfile({
    sub: profile.sub,
    email: profile.email,
    name: profile.name,
  })
  const destination = googleFinishDestination(pkce.next)
  const response = NextResponse.json({ ok: true, destination })
  response.cookies.set(LOCAL_AUTH_COOKIE, principal, memberAuthCookieOptions(requestIsSecure(request)))
  clearGooglePkceCookie(response, request)
  return response
}
