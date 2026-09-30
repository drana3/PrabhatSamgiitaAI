import { NextRequest, NextResponse } from "next/server"

import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import { memberPrincipalFor } from "@/lib/member-request"

export const dynamic = "force-dynamic"

function siteOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const proto = forwardedProto || request.nextUrl.protocol.replace(":", "") || "https"
  return `${proto}://${host}`
}

function clearLocalAuthCookie(response: NextResponse) {
  response.cookies.set(LOCAL_AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

export async function GET(request: NextRequest) {
  const returnTo = `${siteOrigin(request)}/`
  const principal = memberPrincipalFor(request)

  if (!principal) {
    const response = NextResponse.redirect(returnTo, 302)
    clearLocalAuthCookie(response)
    return response
  }

  const logout = new URL("/.auth/logout", siteOrigin(request))
  logout.searchParams.set("post_logout_redirect_uri", returnTo)

  const response = NextResponse.redirect(logout.toString(), 302)
  clearLocalAuthCookie(response)
  return response
}
