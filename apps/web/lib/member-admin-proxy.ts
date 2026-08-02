import type { NextRequest } from "next/server"

export function memberForwardHeaders(request: NextRequest) {
  const headers = new Headers()
  const principal = request.headers.get("x-ms-client-principal")
  const cookie = request.headers.get("cookie")
  if (principal) headers.set("x-ms-client-principal", principal)
  if (cookie) headers.set("cookie", cookie)
  return headers
}

export async function memberSessionIsAdmin(request: NextRequest) {
  try {
    const response = await fetch(new URL("/api/member/session", request.url), {
      headers: memberForwardHeaders(request),
      cache: "no-store",
    })
    if (!response.ok) return false
    const body = await response.json() as { authenticated?: boolean; is_admin?: boolean }
    return body.authenticated === true && body.is_admin === true
  } catch {
    return false
  }
}

export function backendBaseUrl() {
  return process.env.API_BASE_URL
    ?? process.env.NEXT_PUBLIC_API_BASE_URL
    ?? "http://localhost:8000"
}

export async function forwardMemberAdmin(
  request: NextRequest,
  path: string,
  init?: RequestInit,
) {
  const proxyKey = process.env.MEMBER_PROXY_KEY
  const principal = request.headers.get("x-ms-client-principal")
  if (!proxyKey || !principal) {
    return new Response(JSON.stringify({ detail: "Sign in is required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const incoming = new URL(request.url)
  const target = new URL(`/api/v1/members/admin/${path}`, backendBaseUrl())
  target.search = incoming.search

  const response = await fetch(target, {
    ...init,
    method: init?.method ?? request.method,
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
      "X-MS-CLIENT-PRINCIPAL": principal,
      "X-Member-Proxy-Key": proxyKey,
      ...(init?.headers ?? {}),
    },
    body: init?.body ?? (request.method === "GET" || request.method === "HEAD" ? undefined : await request.text()),
    cache: "no-store",
  })

  return new Response(await response.text(), {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
  })
}
