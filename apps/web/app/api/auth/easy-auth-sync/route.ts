import { NextRequest, NextResponse } from "next/server"

import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import {
  type EasyAuthClientPrincipal,
  resolveEasyAuthPrincipalFromRequest,
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

function parseClientPrincipalBody(raw: string): EasyAuthClientPrincipal | null {
  if (!raw.trim()) return null
  try {
    const body = JSON.parse(raw) as { clientPrincipal?: EasyAuthClientPrincipal | null }
    return body?.clientPrincipal ?? null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const raw = await request.text()
  const clientPrincipalFromBody = parseClientPrincipalBody(raw)

  let principal = clientPrincipalFromBody
    ? await resolveEasyAuthPrincipalFromRequest(request, clientPrincipalFromBody)
    : memberPrincipalFor(request)

  if (!principal && !clientPrincipalFromBody) {
    principal = await resolveEasyAuthPrincipalFromRequest(request, null)
  }

  if (!principal) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true, authenticated: true })
  response.cookies.set(LOCAL_AUTH_COOKIE, principal, authCookieOptions())
  return response
}
