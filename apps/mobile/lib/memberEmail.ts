import AsyncStorage from "@react-native-async-storage/async-storage"

import { useAuthStore } from "@/stores/authStore"

const APPLE_EMAIL_PREFIX = "ps.apple.email."

/** The email found for one account, with whose it is: a cached email never goes to another account. */
let cached: { memberId: string | null; email: string } | null = null

async function readStoredAppleEmail(userId: string): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(`${APPLE_EMAIL_PREFIX}${userId}`)
    const trimmed = value?.trim() || ""
    return trimmed.includes("@") ? trimmed : null
  } catch {
    return null
  }
}

/** The email cached for the account signed in now; null for a guest or when the cache belongs to someone else. */
export function getCachedMemberEmail() {
  if (!cached) return null
  const { mode, memberId } = useAuthStore.getState()
  if (mode !== "signed_in") return null
  if (cached.memberId !== (memberId ?? null)) return null
  return cached.email
}

/** Forget the cached email (sign-out). The Apple email kept by user id stays: Apple gives it only once. */
export function clearCachedMemberEmail() {
  cached = null
}

/** Best email for greetings/profile: auth store, memory cache of THIS account, or Apple storage. */
export async function resolveMemberEmail(input: {
  email?: string | null
  memberId?: string | null
  identityProvider?: string | null
}): Promise<string | null> {
  const memberId = input.memberId ?? null
  const direct = (input.email || "").trim()
  if (direct.includes("@")) {
    cached = { memberId, email: direct }
    return direct
  }

  if (cached && cached.memberId === memberId && cached.email.includes("@")) return cached.email

  if (input.identityProvider === "apple" && input.memberId) {
    const stored = await readStoredAppleEmail(input.memberId)
    if (stored) {
      cached = { memberId, email: stored }
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
