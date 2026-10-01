import { NextRequest, NextResponse } from "next/server"

import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import {
  memberAuthCookieOptions,
  OAUTH_RETURN_COOKIE,
  readOAuthReturnPath,
  requestIsSecure,
} from "@/lib/oauth-return-cookie"
import { resolveSwaAuthPrincipalFromRequest } from "@/lib/swa-auth-server"
import { signInReturnPath } from "@/lib/sign-in"

export const dynamic = "force-dynamic"

function readReturnPath(request: NextRequest) {
  const fromCookie = request.cookies.get(OAUTH_RETURN_COOKIE)?.value
  const fromLegacy = request.cookies.get("ps_microsoft_next")?.value
  return readOAuthReturnPath(fromCookie ?? fromLegacy)
}

function completeRedirect(request: NextRequest, principal: string) {
  const secure = requestIsSecure(request)
  const destination = signInReturnPath(readReturnPath(request))
  const response = NextResponse.redirect(new URL(destination, request.url))
  response.cookies.set(LOCAL_AUTH_COOKIE, principal, memberAuthCookieOptions(secure))
  response.cookies.set(OAUTH_RETURN_COOKIE, "", { ...memberAuthCookieOptions(secure), maxAge: 0 })
  response.cookies.set("ps_microsoft_next", "", { ...memberAuthCookieOptions(secure), maxAge: 0 })
  return response
}

export async function GET(request: NextRequest) {
  const principal = await resolveSwaAuthPrincipalFromRequest(request)

  if (!principal) {
    const fallback = new URL("/signin", request.url)
    fallback.searchParams.set("easyAuth", "microsoft")
    fallback.searchParams.set("microsoftError", "no_session")
    return NextResponse.redirect(fallback)
  }

  return completeRedirect(request, principal)
}
