export type OAuthIdentity = {
  id: string
  email: string | null
  displayName: string
  provider: "google" | "facebook" | "aad" | "local"
}

export type AuthSessionPayload = {
  client_principal: string
  display_name: string
  email: string
  identity_provider: string
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
