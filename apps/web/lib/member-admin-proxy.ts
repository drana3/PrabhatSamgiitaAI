import type { NextRequest } from "next/server"

import { isDefaultAdminEmail } from "@/lib/admin-emails"
import { azureAuthForwardHeaders, parseClientPrincipalProfile, resolveClientPrincipal } from "@/lib/azure-principal"

export function memberForwardHeaders(request: NextRequest) {
  return azureAuthForwardHeaders(request.headers)
}

function principalIsDefaultAdmin(request: NextRequest) {
  const principal = resolveClientPrincipal(request.headers)
  if (!principal) return false
  const profile = parseClientPrincipalProfile(principal)
  return isDefaultAdminEmail(profile?.email)
}

export async function memberSessionIsAdmin(request: NextRequest) {
  try {
    const response = await fetch(new URL("/api/member/session", request.url), {
      headers: memberForwardHeaders(request),
      cache: "no-store",
    })
    if (response.ok) {
      const body = await response.json() as { authenticated?: boolean; is_admin?: boolean; email?: string | null }
      if (body.authenticated === true && body.is_admin === true) return true
      if (body.authenticated === true && isDefaultAdminEmail(body.email)) return true
    }
  } catch {
    // Fall through to principal-only admin check.
  }
  return principalIsDefaultAdmin(request)
}

export function backendBaseUrl() {
  return process.env.API_BASE_URL
    ?? process.env.NEXT_PUBLIC_API_BASE_URL
    ?? "http://localhost:8000"
}

export type AdminFeedbackItem = {
  feedback_id: string
  category: string
  rating: number
  comment: string
  page_path: string | null
  contact: string | null
  status: string
  created_at: string
  priority: boolean
}

export type AdminFeedbackResponse = {
  total: number
  items: AdminFeedbackItem[]
  error?: string
}

export async function fetchAdminFeedback(
  source: Headers,
  status = "new",
): Promise<AdminFeedbackResponse> {
  const proxyKey = process.env.MEMBER_PROXY_KEY
  const principal = resolveClientPrincipal(source)
  if (!proxyKey || !principal) {
    return { total: 0, items: [], error: "Sign in is required" }
  }

  const target = new URL("/api/v1/members/admin/feedback", backendBaseUrl())
  target.searchParams.set("status", status)

  try {
    const response = await fetch(target, {
      headers: {
        "X-MS-CLIENT-PRINCIPAL": principal,
        "X-Member-Proxy-Key": proxyKey,
      },
      cache: "no-store",
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      const detail = body && typeof body === "object" && "detail" in body
        ? String((body as { detail?: unknown }).detail ?? "Could not load feedback")
        : "Could not load feedback"
      return { total: 0, items: [], error: detail }
    }
    const payload = body as AdminFeedbackResponse | null
    return {
      total: payload?.total ?? 0,
      items: payload?.items ?? [],
    }
  } catch {
    return { total: 0, items: [], error: "Could not reach the admin service" }
  }
}

export async function forwardMemberAdmin(
  request: NextRequest,
  path: string,
  init?: RequestInit,
) {
  const proxyKey = process.env.MEMBER_PROXY_KEY
  const principal = resolveClientPrincipal(request.headers)
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
