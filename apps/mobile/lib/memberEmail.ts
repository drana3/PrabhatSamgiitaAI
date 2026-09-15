import AsyncStorage from "@react-native-async-storage/async-storage"

import { useAuthStore } from "@/stores/authStore"

const APPLE_EMAIL_PREFIX = "ps.apple.email."

let cachedMemberEmail: string | null = null

async function readStoredAppleEmail(userId: string): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(`${APPLE_EMAIL_PREFIX}${userId}`)
    const trimmed = value?.trim() || ""
    return trimmed.includes("@") ? trimmed : null
  } catch {
    return null
  }
}

export function getCachedMemberEmail() {
  return cachedMemberEmail
}

/** Best email for greetings/profile — auth store, memory cache, or Apple storage. */
export async function resolveMemberEmail(input: {
  email?: string | null
  memberId?: string | null
  identityProvider?: string | null
}): Promise<string | null> {
  const direct = (input.email || "").trim()
  if (direct.includes("@")) {
    cachedMemberEmail = direct
    return direct
  }

  if (cachedMemberEmail?.includes("@")) return cachedMemberEmail

  if (input.identityProvider === "apple" && input.memberId) {
    const stored = await readStoredAppleEmail(input.memberId)
    if (stored) {
      cachedMemberEmail = stored
      return stored
    }
  }

  return null
}

/** Fill auth store + memory cache from Apple storage before member API calls. */
export async function hydrateLocalMemberEmail() {
  const { mode, email, memberId, identityProvider } = useAuthStore.getState()
  if (mode !== "signed_in") return null

  const resolved = await resolveMemberEmail({ email, memberId, identityProvider })
  if (resolved) useAuthStore.getState().setMemberEmail(resolved)
  return resolved
}
