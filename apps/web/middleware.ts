import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { memberSessionIsAdmin } from "@/lib/member-admin-proxy"

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

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
}
