import type { NextRequest } from "next/server"

import { trustedClientIp, trustedProxyHops } from "@/lib/client-ip"
import { backendBaseUrl } from "@/lib/member-admin-proxy"
import { runtimeEnv } from "@/lib/runtime-env"

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

  // The API limits requests per visitor address. The incoming X-Forwarded-For is never copied (its left
  // part is typed by the visitor): the address is rebuilt from the entry the platform added and sent
  // in a header the API accepts only together with the website-only key.
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const webKey = runtimeEnv("WEB_PROXY_KEY")
  const ip = trustedClientIp(
    request.headers.get("x-forwarded-for"),
    trustedProxyHops(runtimeEnv("WEB_TRUSTED_PROXY_HOPS")),
  )
  if (webKey && ip) {
    headers["X-Web-Proxy-Key"] = webKey
    headers["X-Web-Client-Ip"] = ip
  }

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
