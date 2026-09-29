import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies"

import { buildClientPrincipal, hasEasyAuthSessionCookie } from "@/lib/azure-principal"
import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import { memberPrincipalFromHeaders } from "@/lib/member-request"

export type EasyAuthClientPrincipal = {
  identityProvider?: string
  userId?: string
  userDetails?: string
  userRoles?: string[]
  claims?: Array<{ typ?: string; val?: string; type?: string; value?: string }>
}

export function requestOriginFromHeaders(source: Headers) {
  const host = source.get("x-forwarded-host")?.split(",")[0]?.trim() || source.get("host")
  const proto = source.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https"
  if (!host) return null
  return `${proto}://${host}`
}

export function mergeRequestCookies(source: Headers, cookieStore: ReadonlyRequestCookies) {
  const merged = new Headers(source)
  const fromStore = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ")
  if (!fromStore) return merged
  const existing = merged.get("cookie")
  merged.set("cookie", existing ? `${existing}; ${fromStore}` : fromStore)
  return merged
}

export function normalizeEasyAuthProvider(identityProvider?: string) {
  const lower = (identityProvider || "aad").toLowerCase()
  if (lower === "azureactivedirectory" || lower === "entra") return "aad"
  return lower
}

export function isAuthenticatedEasyAuthPrincipal(
  clientPrincipal: EasyAuthClientPrincipal | null | undefined,
): boolean {
  if (!clientPrincipal?.userId?.trim()) return false
  const roles = clientPrincipal.userRoles
  if (!Array.isArray(roles) || roles.length === 0) return true
  return roles.some((role) => role.toLowerCase() === "authenticated")
}

export function principalFromEasyAuthMe(
  clientPrincipal: EasyAuthClientPrincipal | null | undefined,
): string | null {
  if (!isAuthenticatedEasyAuthPrincipal(clientPrincipal)) return null
  const userId = clientPrincipal!.userId!.trim()
  const provider = normalizeEasyAuthProvider(clientPrincipal!.identityProvider)
  const details = clientPrincipal!.userDetails?.trim() || null
  const email = details?.includes("@") ? details : null
  const displayName = details || email || "Prabhat Samgiita member"
  return buildClientPrincipal(userId, displayName, provider, email)
}

export async function fetchEasyAuthClientPrincipal(
  origin: string,
  cookieHeader: string,
): Promise<EasyAuthClientPrincipal | null> {
  if (!cookieHeader || !hasEasyAuthSessionCookie(new Headers({ cookie: cookieHeader }))) {
    return null
  }
  try {
    const response = await fetch(new URL("/.auth/me", origin), {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    })
    if (!response.ok) return null
    const body = (await response.json().catch(() => null)) as {
      clientPrincipal?: EasyAuthClientPrincipal | null
    } | null
    return body?.clientPrincipal ?? null
  } catch {
    return null
  }
}

/** Azure headers, local OAuth cookie, or SWA /.auth/me (when platform headers are missing). */
export async function resolveAuthenticatedPrincipal(
  source: Headers,
  localAuthCookie?: string | null,
  origin?: string | null,
): Promise<string | null> {
  const direct = memberPrincipalFromHeaders(source, localAuthCookie)
  if (direct) return direct

  const cookieHeader = source.get("cookie")
  if (!origin || !cookieHeader) return null

  const clientPrincipal = await fetchEasyAuthClientPrincipal(origin, cookieHeader)
  return principalFromEasyAuthMe(clientPrincipal)
}
