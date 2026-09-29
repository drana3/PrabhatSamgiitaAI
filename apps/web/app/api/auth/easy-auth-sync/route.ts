import { NextRequest, NextResponse } from "next/server"

import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import {
  fetchEasyAuthClientPrincipal,
  principalFromEasyAuthMe,
  requestOriginFromHeaders,
} from "@/lib/easy-auth"
import { memberPrincipalFor } from "@/lib/member-request"

export const dynamic = "force-dynamic"

function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  }
}

export async function POST(request: NextRequest) {
  let principal = memberPrincipalFor(request)
  if (!principal) {
    const origin = requestOriginFromHeaders(request.headers) ?? request.nextUrl.origin
    const clientPrincipal = await fetchEasyAuthClientPrincipal(
      origin,
      request.headers.get("cookie") ?? "",
    )
    principal = principalFromEasyAuthMe(clientPrincipal)
  }

  if (!principal) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 })
  }

  // Only real SWA sign-in reaches here; guests stay on the 15/day AI quota path.
  const response = NextResponse.json({ ok: true, authenticated: true })
  response.cookies.set(LOCAL_AUTH_COOKIE, principal, authCookieOptions())
  return response
}
