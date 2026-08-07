import type { NextRequest } from "next/server"

import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import { resolveClientPrincipal } from "@/lib/azure-principal"
import { backendBaseUrl } from "@/lib/member-admin-proxy"
import { runtimeEnv } from "@/lib/runtime-env"

export function memberPrincipalFromHeaders(
  source: Headers,
  localAuthCookie?: string | null,
) {
  const principal = resolveClientPrincipal(source)
  if (principal) return principal
  if (localAuthCookie) return localAuthCookie
  if (process.env.NODE_ENV !== "production") return process.env.DEV_MEMBER_PRINCIPAL ?? null
  return null
}

export function memberPrincipalFor(request: NextRequest) {
  return memberPrincipalFromHeaders(
    request.headers,
    request.cookies.get(LOCAL_AUTH_COOKIE)?.value,
  )
}

export function isAdminDestination(path: string) {
  return path === "/admin" || path.startsWith("/admin/")
}

export async function fetchBackendMemberSession(principal: string) {
  const proxyKey = runtimeEnv("MEMBER_PROXY_KEY")
  if (!proxyKey) return null

  try {
    const response = await fetch(new URL("/api/v1/members/session", backendBaseUrl()), {
      headers: {
        "X-MS-CLIENT-PRINCIPAL": principal,
        "X-Member-Proxy-Key": proxyKey,
      },
      cache: "no-store",
    })
    if (!response.ok) return null
    return await response.json() as Record<string, unknown>
  } catch {
    return null
  }
}
