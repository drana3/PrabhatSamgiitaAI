import Constants from "expo-constants"
import { Platform } from "react-native"

import { APP_PACKAGE_ID, googleNativeRedirectUri, googleReversedClientId } from "@/lib/oauthRedirectUri"

function readEnv(name: string) {
  return process.env[name]?.trim() || ""
}

function readExtra(name: string) {
  return (Constants.expoConfig?.extra?.[name] as string | undefined)?.trim() || ""
}

/** iOS OAuth client ID from Google Cloud (type: iOS, bundle net.prabhatasamgiita.ai). */
export function googleIosClientId() {
  return readEnv("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID") || readExtra("googleIosClientId")
}

/** Android OAuth client ID from Google Cloud (type: Android, package + SHA-1). */
export function googleAndroidClientId() {
  return readEnv("EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID") || readExtra("googleAndroidClientId")
}

/** Website Web client — required for native Google Sign-In (Android + iOS). */
export function googleWebClientId() {
  return readEnv("EXPO_PUBLIC_GOOGLE_CLIENT_ID") || readExtra("googleClientId")
}

/** OAuth client ID for the current native platform (legacy browser flow helpers). */
export function googleNativeClientId() {
  if (Platform.OS === "ios") return googleIosClientId()
  if (Platform.OS === "android") return googleAndroidClientId()
  return ""
}

export function googleAuthConfigured() {
  if (!googleWebClientId()) return false
  if (Platform.OS === "ios") return Boolean(googleIosClientId())
  if (Platform.OS === "android") return Boolean(googleAndroidClientId())
  return false
}

/** Redirect URI for the platform Google OAuth client (reversed client id scheme). */
export function googleRedirectUriForClient(clientId: string) {
  return googleNativeRedirectUri(clientId)
}

export { googleReversedClientId } from "@/lib/oauthRedirectUri"

export function googleSetupHint() {
  if (Platform.OS === "ios") {
    return (
      "Use an iOS OAuth client in Google Cloud (bundle ID " +
      APP_PACKAGE_ID +
      ") and set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in apps/mobile/.env, then restart Metro."
    )
  }
  if (Platform.OS === "android") {
    return (
      "Use Android + Web OAuth clients in Google Cloud (package " +
      APP_PACKAGE_ID +
      " + SHA-1, and EXPO_PUBLIC_GOOGLE_CLIENT_ID for the Web client)."
    )
  }
  return "Google sign-in is only available on iOS and Android builds."
}
