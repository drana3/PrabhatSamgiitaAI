import { NextRequest, NextResponse } from "next/server"

import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"

const ALLOWED_PROVIDERS = new Set(["google", "facebook", "aad", "local"])

function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    client_principal?: string
    identity_provider?: string
  } | null

  const principal = body?.client_principal?.trim()
  const provider = body?.identity_provider?.trim() ?? "local"
  if (!principal || !ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json({ detail: "Invalid sign-in payload" }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true, identity_provider: provider })
  response.cookies.set(LOCAL_AUTH_COOKIE, principal, authCookieOptions())
  return response
}
