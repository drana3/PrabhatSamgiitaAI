import Constants from "expo-constants"
import { Platform } from "react-native"

import {
  authHeadersForIdentity,
  memberQuotaApplies as memberQuotaAppliesFor,
  resolveMemberAuthIdentity,
  type MemberAuthSnapshot,
} from "@/lib/memberAuthIdentity"
import { bearerHeaders, hasMemberTokens } from "@/lib/memberSession"
import { buildMemberAuthHeaders as buildHeaders } from "@/lib/principal"
import { useAuthStore } from "@/stores/authStore"

export { buildClientPrincipal } from "@/lib/principal"
export type { MemberAuthSnapshot } from "@/lib/memberAuthIdentity"
export { resolveMemberAuthIdentity } from "@/lib/memberAuthIdentity"

function extraValue(key: string): string | undefined {
  const extra = Constants.expoConfig?.extra
  if (!extra || typeof extra !== "object") return undefined
  const value = (extra as Record<string, unknown>)[key]
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

export function memberProxyKey(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_MEMBER_PROXY_KEY?.trim()
  if (fromEnv) return fromEnv
  return extraValue("memberProxyKey") ?? extraValue("EXPO_PUBLIC_MEMBER_PROXY_KEY")
}

/**
 * True when this phone can prove who the member is: it holds signed session tokens, or (older path, until the
 * key is switched off on the server) the shared key is built in.
 */
export function memberAuthAvailable() {
  return hasMemberTokens() || Boolean(memberProxyKey())
}

/**
 * Headers for /members/* and /ai/explain — empty when guest or member sync is unavailable.
 * The signed token wins; the shared key is only the fallback for a phone that has not exchanged yet.
 */
export function authHeadersFromStore(state?: MemberAuthSnapshot): Record<string, string> {
  const snapshot = state ?? useAuthStore.getState()
  if (snapshot.mode === "signed_in" && hasMemberTokens()) return bearerHeaders()
  return authHeadersForIdentity(snapshot, memberProxyKey())
}

export function memberQuotaApplies(state?: MemberAuthSnapshot) {
  const snapshot = state ?? useAuthStore.getState()
  if (snapshot.mode === "signed_in" && hasMemberTokens()) return true
  return memberQuotaAppliesFor(snapshot, memberProxyKey())
}

export function memberSyncUnavailableCopy() {
  if (Platform.OS === "ios") {
    return "Saved songs, quiz certificates, and admin status from the website are not synced in this iOS build. Install the latest TestFlight or App Store update once member sync is included."
  }
  return "Saved songs, quiz certificates, and admin status from the website are not synced in this build yet. Install the latest app update from the team."
}

export function memberSyncFailedCopy() {
  return "Could not sync with your website account yet. Check your connection, then tap Retry sync."
}

export function buildMemberAuthHeaders(
  email: string,
  displayName: string,
  memberId?: string | null,
  identityProvider = "aad",
): Record<string, string> {
  return buildHeaders(email, displayName, memberProxyKey(), memberId, identityProvider)
}
