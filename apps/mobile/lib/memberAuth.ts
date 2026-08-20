import Constants from "expo-constants"
import { Platform } from "react-native"

import { buildMemberAuthHeaders as buildHeaders } from "@/lib/principal"

export { buildClientPrincipal } from "@/lib/principal"

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

export function memberAuthAvailable() {
  return Boolean(memberProxyKey())
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
