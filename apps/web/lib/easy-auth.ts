import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies"

import { buildClientPrincipal, hasEasyAuthSessionCookie } from "@/lib/azure-principal"
import { memberPrincipalFromHeaders } from "@/lib/member-request"
import { resolvePublicSiteOrigin, resolvePublicSiteOriginFromHeaders } from "@/lib/site-origin"

export type EasyAuthClientPrincipal = {
  identityProvider?: string
  userId?: string
  userDetails?: string
  userRoles?: string[]
  claims?: Array<{ typ?: string; val?: string; type?: string; value?: string }>
}

function claimText(claim: { typ?: string; val?: string; type?: string; value?: string }) {
  return (claim.typ || claim.type || "").toLowerCase()
}

function claimValue(claim: { typ?: string; val?: string; type?: string; value?: string }) {
  return (claim.val || claim.value || "").trim()
}

function userIdFromClaims(claims: EasyAuthClientPrincipal["claims"]) {
  if (!Array.isArray(claims)) return null
  const accepted = new Set([
    "http://schemas.microsoft.com/identity/claims/objectidentifier",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
    "oid",
    "sub",
    "nameidentifier",
  ])
  for (const claim of claims) {
    if (accepted.has(claimText(claim))) {
      const value = claimValue(claim)
      if (value) return value
    }
  }
  return null
}

function detailsFromClaims(claims: EasyAuthClientPrincipal["claims"]) {
  if (!Array.isArray(claims)) return null
  const accepted = new Set([
    "email",
    "emails",
    "preferred_username",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "name",
    "http://schemas.microsoft.com/identity/claims/displayname",
  ])
  for (const claim of claims) {
    if (accepted.has(claimText(claim))) {
      const value = claimValue(claim)
      if (value) return value
    }
  }
  return null
}

function normalizeClientPrincipal(value: unknown): EasyAuthClientPrincipal | null {
  if (!value || typeof value !== "object") return null
  const raw = value as EasyAuthClientPrincipal & {
    clientPrincipal?: EasyAuthClientPrincipal | null
    user_id?: string
    user_details?: string
    identity_provider?: string
  }
  if (raw.clientPrincipal) return normalizeClientPrincipal(raw.clientPrincipal)

  const userId = raw.userId?.trim() || raw.user_id?.trim() || userIdFromClaims(raw.claims)
  if (!userId) return null
  const userDetails = raw.userDetails?.trim() || raw.user_details?.trim() || detailsFromClaims(raw.claims) || undefined
  return {
    identityProvider: raw.identityProvider || raw.identity_provider,
    userId,
    userDetails,
    userRoles: raw.userRoles,
    claims: raw.claims,
  }
}

export function parseEasyAuthMePayload(body: unknown): EasyAuthClientPrincipal | null {
  if (body == null) return null
  if (Array.isArray(body)) {
    for (const entry of body) {
      const principal = normalizeClientPrincipal(entry)
      if (principal) return principal
    }
    return null
  }
  return normalizeClientPrincipal(body)
}

export function requestOriginFromHeaders(source: Headers) {
  return resolvePublicSiteOriginFromHeaders(source)
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
  if (Array.isArray(roles) && roles.some((role) => role.toLowerCase() === "authenticated")) return true
  if (!Array.isArray(roles) || roles.length === 0) return true
  // SWA sometimes reports only "anonymous" after a successful AAD login.
  const provider = normalizeEasyAuthProvider(clientPrincipal.identityProvider)
  return provider === "aad" || provider === "google" || provider === "facebook"
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

function decodeHeaderValue(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** When SWA forwards id headers, the /.auth/me userId must match (blocks cookie + spoofed body). */
export function easyAuthPrincipalMatchesHeaders(
  clientPrincipal: EasyAuthClientPrincipal,
  source: Headers,
): boolean {
  const userId = clientPrincipal.userId?.trim()
  if (!userId) return false
  const headerId = source.get("x-ms-client-principal-id")
  if (!headerId) return true
  return decodeHeaderValue(headerId) === userId
}

export async function resolveEasyAuthPrincipalFromRequest(
  request: Request,
  clientPrincipalFromBody?: EasyAuthClientPrincipal | null,
): Promise<string | null> {
  const cookieHeader = request.headers.get("cookie") ?? ""
  const hasPlatformCookie = hasEasyAuthSessionCookie(new Headers({ cookie: cookieHeader }))

  // Next API routes on SWA often never see StaticWebAppsAuthCookie. The browser
  // can still read /.auth/me on the edge; trust that authenticated payload.
  if (clientPrincipalFromBody) {
    return principalFromEasyAuthMe(clientPrincipalFromBody)
  }

  if (!hasPlatformCookie) {
    return null
  }

  let clientPrincipal: EasyAuthClientPrincipal | null = null
  const origin = resolvePublicSiteOrigin(request)
  if (origin) {
    clientPrincipal = await fetchEasyAuthClientPrincipal(origin, cookieHeader)
  }

  if (!clientPrincipal || !easyAuthPrincipalMatchesHeaders(clientPrincipal, request.headers)) {
    return null
  }
  return principalFromEasyAuthMe(clientPrincipal)
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
    const body = await response.json().catch(() => null)
    return parseEasyAuthMePayload(body)
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
