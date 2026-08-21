import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { adminGateCookieOptions, buildAdminGateToken, ADMIN_GATE_COOKIE } from "@/lib/admin-gate"
import { memberSessionIsAdmin } from "@/lib/member-admin-proxy"
import { memberPrincipalFor } from "@/lib/member-request"

function unauthorizedApi() {
  return NextResponse.json({ detail: "Admin access is required" }, { status: 403 })
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/admin/login")) {
    const signin = new URL("/signin", request.url)
    signin.searchParams.set("next", request.nextUrl.searchParams.get("next") || "/admin/feedback")
    return NextResponse.redirect(signin)
  }

  const isAdmin = await memberSessionIsAdmin(request)
  if (!isAdmin) {
    if (pathname.startsWith("/api/admin")) return unauthorizedApi()
    const signin = new URL("/signin", request.url)
    signin.searchParams.set("next", pathname)
    return NextResponse.redirect(signin)
  }

  const response = NextResponse.next()
  const principal = memberPrincipalFor(request)
  if (principal) {
    const token = await buildAdminGateToken(principal)
    if (token) {
      response.cookies.set(
        ADMIN_GATE_COOKIE,
        token,
        adminGateCookieOptions(),
      )
    }
  }
  return response
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
}
