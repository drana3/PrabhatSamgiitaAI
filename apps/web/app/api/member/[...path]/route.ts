import { NextRequest, NextResponse } from "next/server"

const allowedPaths = new Set([
  "session",
  "preferences",
  "favorites",
  "chat-memory",
  "me",
])

function backendBase() {
  return process.env.API_BASE_URL
    ?? process.env.NEXT_PUBLIC_API_BASE_URL
    ?? "http://localhost:8000"
}

function principalFor(request: NextRequest) {
  const principal = request.headers.get("x-ms-client-principal")
  if (principal) return principal
  if (process.env.NODE_ENV !== "production") return process.env.DEV_MEMBER_PRINCIPAL ?? null
  return null
}

async function forward(request: NextRequest, segments: string[]) {
  const root = segments[0] ?? ""
  if (!allowedPaths.has(root)) return NextResponse.json({ detail: "Unknown member endpoint" }, { status: 404 })
  const principal = principalFor(request)
  if (!principal) {
    if (root === "session") return NextResponse.json({ authenticated: false })
    return NextResponse.json({ detail: "Sign in is required" }, { status: 401 })
  }
  const proxyKey = process.env.MEMBER_PROXY_KEY
  if (!proxyKey) return NextResponse.json({ detail: "Member services are not configured" }, { status: 503 })

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
  if (response.status === 204) return new NextResponse(null, { status: 204 })
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
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
