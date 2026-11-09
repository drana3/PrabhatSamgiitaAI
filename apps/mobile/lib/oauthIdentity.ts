export type OAuthIdentity = {
  id: string
  email: string | null
  displayName: string
  provider: "google" | "facebook" | "aad" | "apple" | "local"
  /** Profile picture the provider gave (https URL), when it gave one. */
  photoUrl?: string | null
  /**
   * The provider's own signed proof (Google, Apple, Microsoft ID token). The server checks it with the provider
   * and hands back our session tokens (lib/memberSession.ts). Never stored, never logged.
   */
  idToken?: string | null
  /** Facebook has no ID token: its access token is the proof. */
  accessToken?: string | null
}

export type AuthSessionPayload = {
  client_principal: string
  display_name: string
  email: string
  identity_provider: string
  /** Signed session tokens, sent by servers that support them (docs/security-member-auth.md). */
  access_token?: string | null
  refresh_token?: string | null
  expires_in?: number | null
  account_id?: string | null
}

export function subjectFromPrincipal(principal: string): string {
  try {
    const payload = JSON.parse(
      typeof atob === "function"
        ? atob(principal)
        : Buffer.from(principal, "base64").toString("utf8"),
    ) as { claims?: Array<{ typ?: string; val?: string }> }
    const claims = Array.isArray(payload.claims) ? payload.claims : []
    const accepted = new Set([
      "sub",
      "oid",
      "nameidentifier",
      "http://schemas.microsoft.com/identity/claims/objectidentifier",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
    ])
    for (const claim of claims) {
      const typ = (claim.typ || "").toLowerCase()
      if (accepted.has(typ) && claim.val) return claim.val
    }
    return ""
  } catch {
    return ""
  }
}
