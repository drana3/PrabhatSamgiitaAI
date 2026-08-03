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

export function buildMemberAuthHeaders(
  email: string,
  displayName: string,
  proxyKey?: string,
  memberId?: string | null,
): Record<string, string> {
  if (!proxyKey) return {}
  const principalId = (memberId || email).trim().toLowerCase() || "mobile-preview-member"
  const personName = friendlyPersonName(displayName, email)
  return {
    "X-Member-Proxy-Key": proxyKey,
    "X-MS-CLIENT-PRINCIPAL": buildClientPrincipal(principalId, personName, "aad", email),
  }
}
