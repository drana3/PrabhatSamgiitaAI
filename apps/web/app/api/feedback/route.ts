import type { NextRequest } from "next/server"

import { parseClientPrincipalProfile } from "@/lib/azure-principal"
import { backendBaseUrl } from "@/lib/member-admin-proxy"
import { memberPrincipalFor } from "@/lib/member-request"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  let payload: Record<string, unknown>
  try {
    payload = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ detail: "Invalid feedback payload" }, { status: 400 })
  }

  const principal = memberPrincipalFor(request)
  if (!principal) {
    return Response.json({ detail: "Sign in is required to send feedback" }, { status: 401 })
  }

  const profile = parseClientPrincipalProfile(principal)
  if (profile?.email && !payload.contact) {
    payload.contact = profile.email
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
