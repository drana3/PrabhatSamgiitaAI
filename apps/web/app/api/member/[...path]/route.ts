import { NextRequest, NextResponse } from "next/server"

import { parseClientPrincipalProfile } from "@/lib/azure-principal"
import { memberPrincipalFor } from "@/lib/member-request"
import { runtimeEnv } from "@/lib/runtime-env"

const allowedPaths = new Set([
  "session",
  "preferences",
  "favorites",
  "chat-memory",
  "me",
  "quiz",
])

export const dynamic = "force-dynamic"

function backendBase() {
  return runtimeEnv("API_BASE_URL")
    ?? runtimeEnv("NEXT_PUBLIC_API_BASE_URL")
    ?? "http://localhost:8000"
}

function principalFor(request: NextRequest) {
  return memberPrincipalFor(request)
}

function sessionResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
    },
  })
}

/** Azure-authenticated identity when the live member session payload is unavailable.
 * Must stay authenticated:true or Sign in ↔ /signin redirects loop forever.
 * member_backend is false only when the web proxy key itself is missing.
 */
function principalSessionFallback(principal: string, memberBackend: boolean) {
  const profile = parseClientPrincipalProfile(principal)
  if (!profile) return null
  return {
    ...profile,
    favorite_song_numbers: [],
    personalization_enabled: true,
    member_backend: memberBackend,
  }
}

async function forward(request: NextRequest, segments: string[]) {
  const root = segments[0] ?? ""
  if (!allowedPaths.has(root)) return sessionResponse({ detail: "Unknown member endpoint" }, 404)
  const principal = principalFor(request)
  if (!principal) {
    if (root === "session") return sessionResponse({ authenticated: false })
    return sessionResponse({ detail: "Sign in is required" }, 401)
  }
  const proxyKey = runtimeEnv("MEMBER_PROXY_KEY")
  if (!proxyKey) {
    if (root === "session") {
      const fallback = principalSessionFallback(principal, false)
      if (fallback) return sessionResponse(fallback)
      return sessionResponse({ authenticated: false })
    }
    return sessionResponse({ detail: "Member services are not configured" }, 503)
  }

  const incomingUrl = new URL(request.url)
  const target = new URL(`/api/v1/members/${segments.map(encodeURIComponent).join("/")}`, backendBase())
  target.search = incomingUrl.search
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text()
  const response = await fetch(target, {
    method: request.method,
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
      "X-MS-CLIENT-PRINCIPAL": principal,
      "X-Member-Proxy-Key": proxyKey,
    },
    body,
    cache: "no-store",
  })

  if (root === "session" && !response.ok) {
    // Keep Azure identity visible so the UI does not bounce Sign in → /signin.
    // Proxy key is present, so allow write attempts; favorites/chat show API errors.
    const fallback = principalSessionFallback(principal, true)
    if (fallback) return sessionResponse(fallback)
  }

  if (response.status === 204) {
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store, private" },
    })
  }

  const text = await response.text()
  if (root === "session" && response.ok) {
    try {
      const payload = JSON.parse(text) as Record<string, unknown>
      if (payload && typeof payload === "object") {
        return sessionResponse({ ...payload, member_backend: true })
      }
    } catch {
      // Fall through with the original upstream body.
    }
  }

  return new NextResponse(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store, private",
    },
  })
}

type RouteContext = { params: Promise<{ path: string[] }> }

export async function GET(request: NextRequest, context: RouteContext) {
  return forward(request, (await context.params).path)
}

export async function POST(request: NextRequest, context: RouteContext) {
  return forward(request, (await context.params).path)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return forward(request, (await context.params).path)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return forward(request, (await context.params).path)
}
