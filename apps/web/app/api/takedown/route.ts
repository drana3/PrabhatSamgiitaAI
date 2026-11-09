import type { NextRequest } from "next/server"

import { backendBaseUrl } from "@/lib/member-admin-proxy"

export const dynamic = "force-dynamic"

/** Public: a rights holder files a takedown notice without signing in. Forwards to the API unchanged. */
export async function POST(request: NextRequest) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ detail: "Invalid request" }, { status: 400 })
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return Response.json({ detail: "Invalid request" }, { status: 400 })
  }

  // The API limits requests per visitor address; pass on the address this server saw.
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) headers["X-Forwarded-For"] = forwarded

  let response: Response
  try {
    response = await fetch(new URL("/api/v1/takedown", backendBaseUrl()), {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    })
  } catch {
    return Response.json(
      { detail: "The service is not reachable right now. Please try again later." },
      { status: 502 },
    )
  }

  return new Response(await response.text(), {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
  })
}
