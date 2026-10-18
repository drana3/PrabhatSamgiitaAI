import { getCachedMemberEmail } from "@/lib/memberEmail"
import { buildMemberAuthHeaders as buildHeaders } from "@/lib/principal"

export type MemberAuthSnapshot = {
  mode: "guest" | "signed_in"
  email: string | null
  displayName: string
  memberId: string | null
  identityProvider: string | null
}

/** Signed-in identity that can be encoded into member auth headers (OID and/or email). */
export function resolveMemberAuthIdentity(state: MemberAuthSnapshot) {
  if (state.mode !== "signed_in") return null
  const effectiveEmail = (state.email || getCachedMemberEmail() || "").trim()
  const memberId = (state.memberId || "").trim() || null
  if (!effectiveEmail && !memberId) return null
  return {
    email: effectiveEmail,
    displayName: state.displayName || effectiveEmail || "Member",
    memberId,
    identityProvider: state.identityProvider || "aad",
  }
}

export function authHeadersForIdentity(
  state: MemberAuthSnapshot,
  proxyKey?: string,
): Record<string, string> {
  const identity = resolveMemberAuthIdentity(state)
  if (!identity || !proxyKey) return {}
  return buildHeaders(
    identity.email,
    identity.displayName,
    proxyKey,
    identity.memberId,
    identity.identityProvider,
  )
}

export function memberQuotaApplies(state: MemberAuthSnapshot, proxyKey?: string) {
  return Boolean(proxyKey) && resolveMemberAuthIdentity(state) !== null
}
