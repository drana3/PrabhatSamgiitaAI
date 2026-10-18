import { NextRequest, NextResponse } from "next/server"

import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import { requestIsSecure } from "@/lib/site-origin"

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(LOCAL_AUTH_COOKIE, "", {
    httpOnly: true,
    secure: requestIsSecure(request),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  return response
}
