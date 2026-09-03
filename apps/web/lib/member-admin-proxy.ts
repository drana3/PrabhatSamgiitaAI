import type { NextRequest } from "next/server"

import {
  ADMIN_GATE_COOKIE,
  verifyAdminGateToken,
} from "@/lib/admin-gate"
import { azureAuthForwardHeaders } from "@/lib/azure-principal"
import {
  fetchBackendMemberSession,
  memberPrincipalFor,
  memberPrincipalFromHeaders,
} from "@/lib/member-request"
import { runtimeEnv } from "@/lib/runtime-env"

export function memberForwardHeaders(request: NextRequest) {
  return azureAuthForwardHeaders(request.headers)
}

export async function memberSessionIsAdmin(request: NextRequest) {
  const principal = memberPrincipalFor(request)
  if (!principal) return false

  const gate = request.cookies.get(ADMIN_GATE_COOKIE)?.value
  try {
    if (await verifyAdminGateToken(gate, principal)) return true
  } catch {
    // Fall back to the live member session check below.
  }

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
  localAuthCookie?: string | null,
): Promise<AdminFeedbackResponse> {
  const proxyKey = runtimeEnv("MEMBER_PROXY_KEY")
  const principal = memberPrincipalFromHeaders(source, localAuthCookie)
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
  init?: RequestInit & { timeoutMs?: number },
) {
  const proxyKey = runtimeEnv("MEMBER_PROXY_KEY")
  const principal = memberPrincipalFor(request)
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

  const timeoutMs = init?.timeoutMs ?? 30_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const { timeoutMs: _timeout, ...requestInit } = init ?? {}

  try {
    const response = await fetch(target, {
      ...requestInit,
      method: requestInit.method ?? request.method,
      headers: {
        "Content-Type": request.headers.get("content-type") ?? "application/json",
        "X-MS-CLIENT-PRINCIPAL": principal,
        "X-Member-Proxy-Key": proxyKey,
        ...(requestInit.headers ?? {}),
      },
      body:
        requestInit.body ??
        (request.method === "GET" || request.method === "HEAD" ? undefined : await request.text()),
      cache: "no-store",
      signal: controller.signal,
    })

    return new Response(await response.text(), {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
    })
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? `Admin request timed out after ${Math.round(timeoutMs / 1000)}s`
        : "Could not reach the admin service"
    return new Response(JSON.stringify({ detail: message }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    })
  } finally {
    clearTimeout(timer)
  }
}
