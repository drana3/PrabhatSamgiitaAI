import { NextRequest, NextResponse } from "next/server"

import { googleOAuthClientId, runtimeEnv } from "@/lib/runtime-env"
import { isAllowedWebOAuthRedirect } from "@/lib/site-origin"

function resolvedGoogleClientId(requested?: string) {
  const known = [googleOAuthClientId(), runtimeEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID")].filter(
    (value): value is string => Boolean(value),
  )
  if (requested && known.includes(requested)) return requested
  return known[0]
}

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

  const params = new URLSearchParams({
    client_id: clientId,
    code: body.code,
    redirect_uri: body.redirect_uri,
    grant_type: "authorization_code",
    code_verifier: body.code_verifier,
  })
  const clientSecret = runtimeEnv("GOOGLE_CLIENT_SECRET")
  if (clientSecret) {
    params.set("client_secret", clientSecret)
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store",
  })
  const text = await tokenResponse.text()
  return new NextResponse(text, {
    status: tokenResponse.status,
    headers: {
      "Content-Type": tokenResponse.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store, private",
    },
  })
}
