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
import { publicRedirectUrl, requestIsSecure } from "@/lib/site-origin"

export const dynamic = "force-dynamic"

type FinishInput = {
  code?: string
  state?: string | null
}

async function readFinishInput(request: NextRequest): Promise<FinishInput> {
  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as FinishInput | null
    return { code: body?.code, state: body?.state }
  }
  const form = await request.formData().catch(() => null)
  if (!form) return {}
  return {
    code: String(form.get("code") ?? ""),
    state: form.get("state") ? String(form.get("state")) : null,
  }
}

export async function POST(request: NextRequest) {
  const redirect = request.nextUrl.searchParams.get("redirect") === "1"
  const input = await readFinishInput(request)

  const pkce = parseGooglePkceCookie(request.cookies.get(GOOGLE_PKCE_COOKIE)?.value)
  if (!pkce) {
    if (redirect) {
      return NextResponse.redirect(publicRedirectUrl(request, "/signin?googleError=expired"))
    }
    return NextResponse.json({ detail: "Google sign-in expired. Please try again." }, { status: 400 })
  }
  if (!input.code) {
    if (redirect) {
      return NextResponse.redirect(publicRedirectUrl(request, "/signin?googleError=incomplete"))
    }
    return NextResponse.json({ detail: "Google sign-in payload was incomplete" }, { status: 400 })
  }
  if (input.state && input.state !== pkce.state) {
    if (redirect) {
      return NextResponse.redirect(publicRedirectUrl(request, "/signin?googleError=state"))
    }
    return NextResponse.json({ detail: "Google sign-in could not be verified. Please try again." }, { status: 400 })
  }

  const { ok, tokenBody } = await exchangeGoogleAuthorizationCode({
    clientId: pkce.clientId,
    code: input.code,
    redirectUri: pkce.redirectUri,
    verifier: pkce.verifier,
  })
  if (!ok || !tokenBody?.access_token) {
    if (redirect) {
      const response = NextResponse.redirect(publicRedirectUrl(request, "/signin?googleError=token"))
      clearGooglePkceCookie(response, request)
      return response
    }
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
    if (redirect) {
      const response = NextResponse.redirect(publicRedirectUrl(request, "/signin?googleError=profile"))
      clearGooglePkceCookie(response, request)
      return response
    }
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
  const secure = requestIsSecure(request)

  if (redirect) {
    const response = NextResponse.redirect(publicRedirectUrl(request, destination))
    response.cookies.set(LOCAL_AUTH_COOKIE, principal, memberAuthCookieOptions(secure))
    clearGooglePkceCookie(response, request)
    return response
  }

  const response = NextResponse.json({ ok: true, destination })
  response.cookies.set(LOCAL_AUTH_COOKIE, principal, memberAuthCookieOptions(secure))
  clearGooglePkceCookie(response, request)
  return response
}
