import { NextRequest, NextResponse } from "next/server"

import { resolveClientPrincipal } from "@/lib/azure-principal"

function backendBase() {
  return process.env.API_BASE_URL
    ?? process.env.NEXT_PUBLIC_API_BASE_URL
    ?? "http://localhost:8000"
}

export async function POST(request: NextRequest) {
  const headers: Record<string, string> = {
    "Content-Type": request.headers.get("content-type") ?? "application/json",
  }

  const principal = resolveClientPrincipal(request.headers)
  const proxyKey = process.env.MEMBER_PROXY_KEY
  if (principal && proxyKey) {
    headers["X-MS-CLIENT-PRINCIPAL"] = principal
    headers["X-Member-Proxy-Key"] = proxyKey
  }

  const forwarded = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip")
  if (forwarded) headers["X-Forwarded-For"] = forwarded

  const response = await fetch(`${backendBase()}/api/v1/ai/explain`, {
    method: "POST",
    headers,
    body: await request.text(),
    cache: "no-store",
  })

  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "text/event-stream",
    },
  })
}
