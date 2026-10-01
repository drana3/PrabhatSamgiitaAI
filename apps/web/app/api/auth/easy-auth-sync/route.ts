import { NextRequest, NextResponse } from "next/server"

import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import {
  type EasyAuthClientPrincipal,
  resolveEasyAuthPrincipalFromRequest,
} from "@/lib/easy-auth"
import { memberPrincipalFor } from "@/lib/member-request"
import { memberAuthCookieOptions } from "@/lib/oauth-return-cookie"
import { requestIsSecure } from "@/lib/site-origin"

export const dynamic = "force-dynamic"

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
  response.cookies.set(LOCAL_AUTH_COOKIE, principal, memberAuthCookieOptions(requestIsSecure(request)))
  return response
}
