import type { NextRequest } from "next/server"

import { runtimeEnv } from "@/lib/runtime-env"

function apiBase() {
  return (
    runtimeEnv("API_BASE_URL") ??
    runtimeEnv("NEXT_PUBLIC_API_BASE_URL") ??
    "http://localhost:8000"
  )
}

/** Same-origin proxy so the community ticker works on every web host (avoids CORS). */
export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get("limit")
  const limit = Math.min(20, Math.max(1, Number(limitParam) || 20))
  try {
    const response = await fetch(`${apiBase()}/api/v1/testimonials?limit=${limit}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
    const body = await response.text()
    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return Response.json({ detail: "Could not load community voices." }, { status: 502 })
  }
}
