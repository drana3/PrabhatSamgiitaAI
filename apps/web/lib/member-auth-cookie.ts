import type { NextResponse } from "next/server"

import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import { memberAuthCookieOptions } from "@/lib/oauth-return-cookie"
import { requestIsSecure } from "@/lib/site-origin"

/** Single app session cookie for web (same blob mobile-backed APIs already accept). */
export function attachMemberAuthCookie(response: NextResponse, request: Request, principal: string) {
  response.cookies.set(LOCAL_AUTH_COOKIE, principal, memberAuthCookieOptions(requestIsSecure(request)))
}
