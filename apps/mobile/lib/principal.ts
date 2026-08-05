/**
 * Azure Easy Auth–compatible principal helpers (pure — safe for unit tests).
 */
import { friendlyPersonName, looksLikeEmail } from "@/lib/displayName"

export function buildClientPrincipal(
  id: string,
  name?: string | null,
  provider = "aad",
  email?: string | null,
) {
  const claims: Array<{ typ: string; val: string }> = [
    {
      typ: "http://schemas.microsoft.com/identity/claims/objectidentifier",
      val: id,
    },
    {
      typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
      val: id,
    },
  ]

  const personName = friendlyPersonName(name, email)
  if (personName) {
    claims.push({ typ: "name", val: personName })
    claims.push({
      typ: "http://schemas.microsoft.com/identity/claims/displayname",
      val: personName,
    })
  }

  const emailClaim =
    (email && looksLikeEmail(email) ? email.trim() : null) ||
    (name && looksLikeEmail(name) ? name.trim() : null)
  if (emailClaim) {
    claims.push({ typ: "email", val: emailClaim })
    claims.push({ typ: "preferred_username", val: emailClaim })
    claims.push({
      typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      val: emailClaim,
    })
  }

  const json = JSON.stringify({ auth_typ: provider, claims })
  const bytes = unescape(encodeURIComponent(json))
  if (typeof btoa === "function") return btoa(bytes)
  return Buffer.from(json, "utf8").toString("base64")
}

/**
 * Principal object id for Easy Auth compatibility.
 * Prefer the Microsoft OID / stable subject. Do not fall back to a normal email —
 * that creates a parallel `aad:email` account separate from website Easy Auth.
 */
export function resolvePrincipalId(memberId?: string | null, email?: string | null): string {
  const subject = (memberId || "").trim()
  if (subject) return subject
  const mail = (email || "").trim()
  if (mail && looksLikeEmail(mail) && mail.toLowerCase().endsWith("@prabhat.local")) {
    return "mobile-preview"
  }
  if (mail && looksLikeEmail(mail)) {
    // Legacy fallback only for tests / broken state — never a real member email as OID.
    return `preview:${mail.toLowerCase()}`
  }
  return "mobile-preview"
}

export function buildMemberAuthHeaders(
  email: string,
  displayName: string,
  proxyKey?: string,
  memberId?: string | null,
): Record<string, string> {
  if (!proxyKey) return {}
  const principalId = resolvePrincipalId(memberId, email)
  const personName = friendlyPersonName(displayName, email)
  const emailForClaims =
    email && looksLikeEmail(email) && !email.toLowerCase().endsWith("@prabhat.local")
      ? email
      : null
  return {
    "X-Member-Proxy-Key": proxyKey,
    "X-MS-CLIENT-PRINCIPAL": buildClientPrincipal(
      principalId,
      personName,
      "aad",
      emailForClaims,
    ),
  }
}
