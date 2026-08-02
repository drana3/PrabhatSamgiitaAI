import type { NextRequest } from "next/server"

import { parseClientPrincipalProfile, resolveClientPrincipal } from "@/lib/azure-principal"
import { backendBaseUrl } from "@/lib/member-admin-proxy"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  let payload: Record<string, unknown>
  try {
    payload = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ detail: "Invalid feedback payload" }, { status: 400 })
  }

  const principal = resolveClientPrincipal(request.headers)
  if (principal) {
    const profile = parseClientPrincipalProfile(principal)
    if (profile?.email && !payload.contact) {
      payload.contact = profile.email
    }
  }

  const target = new URL("/api/v1/feedback", backendBaseUrl())
  const response = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  return new Response(await response.text(), {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
  })
}
