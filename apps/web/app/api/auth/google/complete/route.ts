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

export async function GET(request: NextRequest) {
  const secure = requestIsSecure(request)
  const principal = await resolveSwaAuthPrincipalFromRequest(request)

  if (!principal) {
    const fallback = new URL("/signin", request.url)
    fallback.searchParams.set("googleError", "no_session")
    return NextResponse.redirect(fallback)
  }

  const rawNext = request.cookies.get(OAUTH_RETURN_COOKIE)?.value
  const destination = signInReturnPath(readOAuthReturnPath(rawNext))
  const response = NextResponse.redirect(new URL(destination, request.url))
  response.cookies.set(LOCAL_AUTH_COOKIE, principal, memberAuthCookieOptions(secure))
  response.cookies.set(OAUTH_RETURN_COOKIE, "", { ...memberAuthCookieOptions(secure), maxAge: 0 })
  return response
}
