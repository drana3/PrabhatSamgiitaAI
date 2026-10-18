import { NextRequest, NextResponse } from "next/server"

import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import {
  memberAuthCookieOptions,
  OAUTH_RETURN_COOKIE,
  readOAuthReturnPath,
} from "@/lib/oauth-return-cookie"
import { requestIsSecure } from "@/lib/site-origin"
import { resolveSwaAuthPrincipalFromRequest } from "@/lib/swa-auth-server"
import { signInReturnPath } from "@/lib/sign-in"
import { publicRedirectUrl } from "@/lib/site-origin"

export const dynamic = "force-dynamic"

function readReturnPath(request: NextRequest) {
  const fromCookie = request.cookies.get(OAUTH_RETURN_COOKIE)?.value
  const fromLegacy = request.cookies.get("ps_microsoft_next")?.value
  return readOAuthReturnPath(fromCookie ?? fromLegacy)
}

function completeRedirect(request: NextRequest, principal: string) {
  const secure = requestIsSecure(request)
  const destination = signInReturnPath(readReturnPath(request))
  const response = NextResponse.redirect(publicRedirectUrl(request, destination))
  response.cookies.set(LOCAL_AUTH_COOKIE, principal, memberAuthCookieOptions(secure))
  response.cookies.set(OAUTH_RETURN_COOKIE, "", { ...memberAuthCookieOptions(secure), maxAge: 0 })
  response.cookies.set("ps_microsoft_next", "", { ...memberAuthCookieOptions(secure), maxAge: 0 })
  return response
}

export async function GET(request: NextRequest) {
  const principal = await resolveSwaAuthPrincipalFromRequest(request)

  if (!principal) {
    const fallback = new URL(publicRedirectUrl(request, "/auth/callback/microsoft"))
    fallback.searchParams.set("browser", "1")
    return NextResponse.redirect(fallback.toString())
  }

  return completeRedirect(request, principal)
}
