import { NextRequest, NextResponse } from "next/server"

import { exchangeGoogleAuthorizationCode, resolvedGoogleClientId } from "@/lib/google-oauth-server"
import { isAllowedWebOAuthRedirect } from "@/lib/site-origin"

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    client_id?: string
    code?: string
    redirect_uri?: string
    code_verifier?: string
  } | null

  const clientId = resolvedGoogleClientId(body?.client_id?.trim())
  if (!clientId) {
    return NextResponse.json({ detail: "Google sign-in is not configured" }, { status: 503 })
  }
  if (!body?.code || !body.redirect_uri || !body.code_verifier) {
    return NextResponse.json({ detail: "Google sign-in payload was incomplete" }, { status: 400 })
  }
  if (!isAllowedWebOAuthRedirect(request, body.redirect_uri)) {
    return NextResponse.json({ detail: "Google redirect URI is not allowed" }, { status: 400 })
  }

  const { ok, status, tokenBody } = await exchangeGoogleAuthorizationCode({
    clientId,
    code: body.code,
    redirectUri: body.redirect_uri,
    verifier: body.code_verifier,
  })
  return NextResponse.json(tokenBody ?? { error: "token_exchange_failed" }, {
    status: ok ? 200 : status,
    headers: { "Cache-Control": "no-store, private" },
  })
}
