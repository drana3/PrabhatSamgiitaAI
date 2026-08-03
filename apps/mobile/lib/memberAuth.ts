import Constants from "expo-constants"

import { buildMemberAuthHeaders as buildHeaders } from "@/lib/principal"

export { buildClientPrincipal } from "@/lib/principal"

export function memberProxyKey(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_MEMBER_PROXY_KEY?.trim()
  if (fromEnv) return fromEnv
  const fromExtra = Constants.expoConfig?.extra?.memberProxyKey
  return typeof fromExtra === "string" && fromExtra.trim() ? fromExtra.trim() : undefined
}

export function memberAuthAvailable() {
  return Boolean(memberProxyKey())
}

export function buildMemberAuthHeaders(email: string, displayName: string, memberId?: string | null): Record<string, string> {
  return buildHeaders(email, displayName, memberProxyKey(), memberId)
}
