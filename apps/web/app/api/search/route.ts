import { NextRequest, NextResponse } from "next/server"

import { backendBaseUrl } from "@/lib/member-admin-proxy"
import { memberPrincipalFor } from "@/lib/member-request"
import { runtimeEnv } from "@/lib/runtime-env"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const principal = memberPrincipalFor(request)
  const proxyKey = runtimeEnv("MEMBER_PROXY_KEY")
  if (!principal || !proxyKey) {
    return NextResponse.json({ detail: "Sign in is required for Feeling search." }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ detail: "Invalid search payload" }, { status: 400 })
  }

  const target = new URL("/api/v1/search", backendBaseUrl())
  const response = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MS-CLIENT-PRINCIPAL": principal,
      "X-Member-Proxy-Key": proxyKey,
    },
    body: JSON.stringify({ ...payload, mode: "semantic" }),
    cache: "no-store",
  })
  const body = await response.text()
  return new NextResponse(body, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
  })
}
