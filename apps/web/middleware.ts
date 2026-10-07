import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { adminGateCookieOptions, buildAdminGateToken, ADMIN_GATE_COOKIE } from "@/lib/admin-gate"
import { memberSessionIsAdmin } from "@/lib/member-admin-proxy"
import { memberPrincipalFor } from "@/lib/member-request"
import { apexToWwwRedirectUrl, publicRedirectUrl } from "@/lib/site-origin"

function unauthorizedApi() {
  return NextResponse.json({ detail: "Admin access is required" }, { status: 403 })
}

export async function middleware(request: NextRequest) {
  const apexRedirect = apexToWwwRedirectUrl(request)
  if (apexRedirect) {
    return NextResponse.redirect(apexRedirect, 301)
  }

  const { pathname } = request.nextUrl

  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/admin/login")) {
    const next = request.nextUrl.searchParams.get("next") || "/admin/feedback"
    return NextResponse.redirect(
      publicRedirectUrl(request, `/signin?next=${encodeURIComponent(next)}`),
    )
  }

  const isAdmin = await memberSessionIsAdmin(request)
  if (!isAdmin) {
    if (pathname.startsWith("/api/admin")) return unauthorizedApi()
    return NextResponse.redirect(
      publicRedirectUrl(request, `/signin?next=${encodeURIComponent(pathname)}`),
    )
  }

  const response = NextResponse.next()
  const principal = memberPrincipalFor(request)
  if (principal) {
    try {
      const token = await buildAdminGateToken(principal)
      if (token) {
        response.cookies.set(
          ADMIN_GATE_COOKIE,
          token,
          adminGateCookieOptions(),
        )
      }
    } catch {
      // Gate cookie is optional; admin access still works via live session checks.
    }
  }
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
