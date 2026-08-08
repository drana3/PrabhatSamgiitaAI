import { NextRequest, NextResponse } from "next/server"

import { googleOAuthClientId, runtimeEnv } from "@/lib/runtime-env"

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    code?: string
    redirect_uri?: string
    code_verifier?: string
  } | null

  const clientId = googleOAuthClientId()
  if (!clientId) {
    return NextResponse.json({ detail: "Google sign-in is not configured" }, { status: 503 })
  }
  if (!body?.code || !body.redirect_uri || !body.code_verifier) {
    return NextResponse.json({ detail: "Google sign-in payload was incomplete" }, { status: 400 })
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
