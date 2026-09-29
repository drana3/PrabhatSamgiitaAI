import { NextRequest, NextResponse } from "next/server"

import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"

export const dynamic = "force-dynamic"

function siteOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const proto = forwardedProto || request.nextUrl.protocol.replace(":", "") || "https"
  return `${proto}://${host}`
}

export async function GET(request: NextRequest) {
  const returnTo = `${siteOrigin(request)}/signin?signedOut=1`
  const logout = new URL("/.auth/logout", siteOrigin(request))
  logout.searchParams.set("post_logout_redirect_uri", returnTo)

  const response = NextResponse.redirect(logout.toString(), 302)
  response.cookies.set(LOCAL_AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  return response
}
