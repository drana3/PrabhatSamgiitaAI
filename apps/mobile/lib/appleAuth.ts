import AsyncStorage from "@react-native-async-storage/async-storage"
import * as AppleAuthentication from "expo-apple-authentication"
import { Platform } from "react-native"

import { isApplePrivateRelayEmail, isGenericMemberLabel } from "@/lib/displayName"
import { facebookAuthConfigured } from "@/lib/facebookAuth"
import { googleAuthConfigured } from "@/lib/googleOAuthConfig"
import { microsoftAuthConfigured } from "@/lib/msal"
import type { OAuthIdentity } from "@/lib/oauthIdentity"

const APPLE_NAME_PREFIX = "ps.apple.displayName."
const APPLE_EMAIL_PREFIX = "ps.apple.email."

export async function readStoredAppleEmail(userId: string): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(`${APPLE_EMAIL_PREFIX}${userId}`)
    const trimmed = value?.trim() || ""
    return trimmed.includes("@") ? trimmed : null
  } catch {
    return null
  }
}

async function writeStoredAppleEmail(userId: string, email: string) {
  const trimmed = email.trim()
  if (!trimmed.includes("@")) return
  try {
    await AsyncStorage.setItem(`${APPLE_EMAIL_PREFIX}${userId}`, trimmed)
  } catch {
    // Best-effort.
  }
}

async function resolveAppleEmail(userId: string, email: string | null): Promise<string | null> {
  if (email?.trim()) {
    await writeStoredAppleEmail(userId, email)
    return email.trim()
  }
  return readStoredAppleEmail(userId)
}

export function appleAuthConfigured() {
  return Platform.OS === "ios"
}

/** App Store 4.8: offer Sign in with Apple when other third-party login is shown on iOS. */
export function appleSignInOffered() {
  if (!appleAuthConfigured()) return false
  return (
    microsoftAuthConfigured() || googleAuthConfigured() || facebookAuthConfigured()
  )
}

function displayNameFromApple(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
  email: string | null,
): string {
  if (fullName) {
    const parts = [fullName.givenName, fullName.familyName].filter(Boolean)
    if (parts.length) return parts.join(" ")
  }
  if (email) {
    const local = email.split("@")[0]?.trim()
    if (local && !isGenericMemberLabel(local)) return local
  }
  return ""
}

async function readStoredAppleDisplayName(userId: string): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(`${APPLE_NAME_PREFIX}${userId}`)
    const trimmed = value?.trim() || ""
    return trimmed && !isGenericMemberLabel(trimmed) ? trimmed : null
  } catch {
    return null
  }
}

async function writeStoredAppleDisplayName(userId: string, name: string) {
  const trimmed = name.trim()
  if (!trimmed || isGenericMemberLabel(trimmed)) return
  try {
    await AsyncStorage.setItem(`${APPLE_NAME_PREFIX}${userId}`, trimmed)
  } catch {
    // Best-effort — greeting fallbacks still apply.
  }
}

async function resolveAppleDisplayName(
  userId: string,
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
  email: string | null,
): Promise<string> {
  const fromCredential = displayNameFromApple(fullName, email)
  if (fromCredential) {
    await writeStoredAppleDisplayName(userId, fromCredential)
    return fromCredential
  }
  const stored = await readStoredAppleDisplayName(userId)
  return stored || ""
}

export async function signInWithApple(): Promise<OAuthIdentity> {
  if (Platform.OS !== "ios") {
    throw new Error("Sign in with Apple is only available on iOS.")
  }

  const available = await AppleAuthentication.isAvailableAsync()
  if (!available) {
    throw new Error("Sign in with Apple is not available on this device.")
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    })
    if (!credential.user) {
      throw new Error("Could not read your Apple account profile.")
    }
    return {
      id: credential.user,
      email: await resolveAppleEmail(credential.user, credential.email ?? null),
      displayName: await resolveAppleDisplayName(
        credential.user,
        credential.fullName,
        credential.email ?? (await readStoredAppleEmail(credential.user)),
      ),
      provider: "apple",
    }
  } catch (error) {
    const code = (error as { code?: string })?.code
    if (code === "ERR_REQUEST_CANCELED") {
      throw new Error("Sign-in was cancelled.")
    }
    if (error instanceof Error && error.message) throw error
    throw new Error("Sign in with Apple didn’t finish. Try again.")
  }
}
