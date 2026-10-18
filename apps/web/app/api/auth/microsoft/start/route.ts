import { NextRequest, NextResponse } from "next/server"

import { microsoftSignInHref, safeSignInNextPath } from "@/lib/sign-in"
import { OAUTH_RETURN_COOKIE, memberAuthCookieOptions } from "@/lib/oauth-return-cookie"
import { publicRedirectUrl, requestIsSecure } from "@/lib/site-origin"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const next = safeSignInNextPath(request.nextUrl.searchParams.get("next") ?? undefined)
  const secure = requestIsSecure(request)
  const response = NextResponse.redirect(publicRedirectUrl(request, microsoftSignInHref()))
  response.cookies.set(OAUTH_RETURN_COOKIE, encodeURIComponent(next), memberAuthCookieOptions(secure))
  return response
}
