import type { MemberProfile } from "@/lib/member"

type Claim = { typ: string; val: string }

const NAME_CLAIMS = new Set([
  "name",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
  "http://schemas.microsoft.com/identity/claims/displayname",
])
const EMAIL_CLAIMS = new Set([
  "email",
  "emails",
  "preferred_username",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
])
const SUBJECT_CLAIMS = new Set([
  "sub",
  "oid",
  "nameidentifier",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
  "http://schemas.microsoft.com/identity/claims/objectidentifier",
])

function claimValue(claims: Claim[], accepted: Set<string>) {
  for (const claim of claims) {
    const claimType = (claim.typ || "").toLowerCase()
    if (accepted.has(claimType)) {
      const value = (claim.val || "").trim()
      if (value) return value
    }
  }
  return null
}

function decodeHeaderValue(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function buildClientPrincipal(id: string, name?: string | null, provider = "aad") {
  const claims: Claim[] = [
    {
      typ: "http://schemas.microsoft.com/identity/claims/objectidentifier",
      val: id,
    },
    {
      typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
      val: id,
    },
  ]

  if (name) {
    claims.push({ typ: "name", val: name })
    claims.push({
      typ: "http://schemas.microsoft.com/identity/claims/displayname",
      val: name,
    })
    if (name.includes("@")) {
      claims.push({ typ: "email", val: name })
      claims.push({ typ: "preferred_username", val: name })
      claims.push({
        typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
        val: name,
      })
    }
  }

  const payload = { auth_typ: provider, claims }
  return Buffer.from(JSON.stringify(payload)).toString("base64")
}

export function resolveClientPrincipal(source: Headers) {
  const existing = source.get("x-ms-client-principal")
  if (existing) return existing

  const id = source.get("x-ms-client-principal-id")
  if (!id) return null

  const name = source.get("x-ms-client-principal-name")
  return buildClientPrincipal(decodeHeaderValue(id), name ? decodeHeaderValue(name) : null)
}

export function parseClientPrincipalProfile(principal: string): MemberProfile | null {
  try {
    const payload = JSON.parse(Buffer.from(`${principal}===`, "base64").toString("utf8")) as {
      auth_typ?: string
      identity_provider?: string
      user_id?: string
      user_details?: string
      claims?: Claim[]
    }
    const claims = Array.isArray(payload.claims) ? payload.claims : []
    const provider = payload.auth_typ || payload.identity_provider || "aad"
    const subject = claimValue(claims, SUBJECT_CLAIMS) || payload.user_id || ""
    const email = claimValue(claims, EMAIL_CLAIMS) || payload.user_details || null
    const displayName = claimValue(claims, NAME_CLAIMS) || email || "Prabhat Samgiita member"
    if (!subject) return null
    return {
      authenticated: true,
      id: `${provider}:${subject}`,
      display_name: displayName.slice(0, 255),
      email: email ? email.slice(0, 320) : null,
      identity_provider: provider,
      personalization_enabled: true,
      favorite_song_numbers: [],
      is_admin: false,
    }
  } catch {
    return null
  }
}

export function azureAuthForwardHeaders(source: Headers) {
  const headers = new Headers()
  for (const name of [
    "x-ms-client-principal",
    "x-ms-client-principal-id",
    "x-ms-client-principal-name",
    "cookie",
  ]) {
    const value = source.get(name)
    if (value) headers.set(name, value)
  }
  return headers
}
