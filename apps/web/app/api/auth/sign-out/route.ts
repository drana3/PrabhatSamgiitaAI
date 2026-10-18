import { NextRequest, NextResponse } from "next/server"

import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import { memberPrincipalFor } from "@/lib/member-request"
import { requestIsSecure, resolvePublicSiteOrigin } from "@/lib/site-origin"

export const dynamic = "force-dynamic"

function clearLocalAuthCookie(request: NextRequest, response: NextResponse) {
  response.cookies.set(LOCAL_AUTH_COOKIE, "", {
    httpOnly: true,
    secure: requestIsSecure(request),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

export async function GET(request: NextRequest) {
  const origin = resolvePublicSiteOrigin(request)
  const returnTo = `${origin}/?signedOut=1`
  const principal = memberPrincipalFor(request)

  if (!principal) {
    const response = NextResponse.redirect(returnTo, 302)
    clearLocalAuthCookie(request, response)
    return response
  }

  const logout = new URL("/.auth/logout", origin)
  logout.searchParams.set("post_logout_redirect_uri", returnTo)

  const response = NextResponse.redirect(logout.toString(), 302)
  clearLocalAuthCookie(request, response)
  return response
}
