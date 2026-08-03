export type MicrosoftIdentity = {
  id: string
  email: string | null
  displayName: string
  idToken?: string
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
    const json =
      typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("utf8")
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

export function identityFromIdToken(idToken: string): MicrosoftIdentity | null {
  const claims = decodeJwtPayload(idToken)
  if (!claims) return null
  const email =
    (typeof claims.email === "string" && claims.email) ||
    (typeof claims.preferred_username === "string" && claims.preferred_username) ||
    (typeof claims.upn === "string" && claims.upn) ||
    null
  const id =
    (typeof claims.oid === "string" && claims.oid) ||
    (typeof claims.sub === "string" && claims.sub) ||
    email
  if (!id) return null
  const displayName =
    (typeof claims.name === "string" && claims.name) || email || "Microsoft member"
  return { id, email, displayName, idToken }
}
