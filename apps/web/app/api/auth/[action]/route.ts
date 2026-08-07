import { NextRequest, NextResponse } from "next/server"

import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import { runtimeEnv } from "@/lib/runtime-env"

function backendBase() {
  return runtimeEnv("API_BASE_URL")
    ?? runtimeEnv("NEXT_PUBLIC_API_BASE_URL")
    ?? "http://localhost:8000"
}

function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  }
}

async function forwardAuth(path: "register" | "login", body: string) {
  const response = await fetch(`${backendBase()}/api/v1/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  })
  const text = await response.text()
  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store, private",
    },
  })
}

function withPrincipalCookie(response: NextResponse, principal: string) {
  response.cookies.set(LOCAL_AUTH_COOKIE, principal, authCookieOptions())
  return response
}

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params
  if (action !== "register" && action !== "login") {
    return NextResponse.json({ detail: "Unknown auth action" }, { status: 404 })
  }

  const body = await request.text()
  const upstream = await forwardAuth(action, body)
  const text = await upstream.text()
  if (!upstream.ok) {
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store, private",
      },
    })
  }

  try {
    const payload = JSON.parse(text) as { client_principal?: string }
    if (!payload.client_principal) {
      return NextResponse.json({ detail: "Authentication response was incomplete" }, { status: 502 })
    }
    return withPrincipalCookie(
      NextResponse.json({ ok: true, identity_provider: payload.identity_provider ?? "local" }),
      payload.client_principal,
    )
  } catch {
    return NextResponse.json({ detail: "Authentication response was invalid" }, { status: 502 })
  }
}
