import { NextRequest, NextResponse } from "next/server"

import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import { resolveMicrosoftPrincipalFromRequest } from "@/lib/microsoft-auth-server"
import {
  memberAuthCookieOptions,
  MICROSOFT_NEXT_COOKIE,
  requestIsSecure,
} from "@/lib/member-auth-cookie"
import { safeSignInNextPath, signInReturnPath } from "@/lib/sign-in"

export const dynamic = "force-dynamic"

function readMicrosoftNext(request: NextRequest) {
  const raw = request.cookies.get(MICROSOFT_NEXT_COOKIE)?.value
  if (!raw) return "/"
  try {
    return safeSignInNextPath(decodeURIComponent(raw))
  } catch {
    return safeSignInNextPath(raw)
  }
}

export async function GET(request: NextRequest) {
  const secure = requestIsSecure(request)
  const next = readMicrosoftNext(request)
  const principal = await resolveMicrosoftPrincipalFromRequest(request)

  if (!principal) {
    const fallback = new URL("/signin", request.url)
    fallback.searchParams.set("easyAuth", "microsoft")
    fallback.searchParams.set("microsoftError", "no_session")
    return NextResponse.redirect(fallback)
  }

  const destination = signInReturnPath(next)
  const response = NextResponse.redirect(new URL(destination, request.url))
  response.cookies.set(LOCAL_AUTH_COOKIE, principal, memberAuthCookieOptions(secure))
  response.cookies.set(MICROSOFT_NEXT_COOKIE, "", { ...memberAuthCookieOptions(secure), maxAge: 0 })
  return response
}
