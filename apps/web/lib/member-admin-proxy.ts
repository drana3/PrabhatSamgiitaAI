import type { NextRequest } from "next/server"

import {
  ADMIN_GATE_COOKIE,
  verifyAdminGateToken,
} from "@/lib/admin-gate"
import { azureAuthForwardHeaders, resolveClientPrincipal } from "@/lib/azure-principal"
import { fetchBackendMemberSession, memberPrincipalFor } from "@/lib/member-request"
import { runtimeEnv } from "@/lib/runtime-env"

export function memberForwardHeaders(request: NextRequest) {
  return azureAuthForwardHeaders(request.headers)
}

export async function memberSessionIsAdmin(request: NextRequest) {
  const principal = memberPrincipalFor(request)
  if (!principal) return false

  const gate = request.cookies.get(ADMIN_GATE_COOKIE)?.value
  if (await verifyAdminGateToken(gate, principal)) return true

  const session = await fetchBackendMemberSession(principal)
  return session?.authenticated === true && session?.is_admin === true
}

export function backendBaseUrl() {
  return runtimeEnv("API_BASE_URL")
    ?? runtimeEnv("NEXT_PUBLIC_API_BASE_URL")
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
  on_live_ticker?: boolean
}

export type AdminFeedbackResponse = {
  total: number
  items: AdminFeedbackItem[]
  error?: string
}

function adminProxyAuthError(proxyKey: string | undefined, principal: string | null) {
  if (!proxyKey) return "Member services are not configured"
  if (!principal) return "Sign in is required"
  return null
}

function readAdminDetail(body: unknown, fallback: string) {
  if (!body || typeof body !== "object" || !("detail" in body)) return fallback
  const detail = (body as { detail?: unknown }).detail
  if (typeof detail === "string" && detail.trim()) return detail
  return fallback
}

export async function fetchAdminFeedback(
  source: Headers,
  status = "new",
): Promise<AdminFeedbackResponse> {
  const proxyKey = runtimeEnv("MEMBER_PROXY_KEY")
  const principal = resolveClientPrincipal(source)
  const authError = adminProxyAuthError(proxyKey, principal)
  if (authError) {
    return { total: 0, items: [], error: authError }
  }

  const target = new URL("/api/v1/members/admin/feedback", backendBaseUrl())
  target.searchParams.set("status", status)

  try {
    const response = await fetch(target, {
      headers: {
        "X-MS-CLIENT-PRINCIPAL": principal!,
        "X-Member-Proxy-Key": proxyKey!,
      },
      cache: "no-store",
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      return {
        total: 0,
        items: [],
        error: readAdminDetail(body, `Could not load feedback (${response.status})`),
      }
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
  const proxyKey = runtimeEnv("MEMBER_PROXY_KEY")
  const principal = resolveClientPrincipal(request.headers)
  const authError = adminProxyAuthError(proxyKey, principal)
  if (authError || !proxyKey || !principal) {
    return new Response(JSON.stringify({ detail: authError ?? "Sign in is required" }), {
      status: authError === "Sign in is required" || !principal ? 401 : 503,
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
