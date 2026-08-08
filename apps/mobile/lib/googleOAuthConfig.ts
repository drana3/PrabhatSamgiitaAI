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

/** Website Web client — used on web only, not for native Google sign-in. */
export function googleWebClientId() {
  return readEnv("EXPO_PUBLIC_GOOGLE_CLIENT_ID") || readExtra("googleClientId")
}

/** OAuth client ID for the current native platform. */
export function googleNativeClientId() {
  if (Platform.OS === "ios") return googleIosClientId()
  if (Platform.OS === "android") return googleAndroidClientId()
  return ""
}

export function googleAuthConfigured() {
  return Boolean(googleNativeClientId())
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
      "Use an Android OAuth client in Google Cloud (package " +
      APP_PACKAGE_ID +
      " + SHA-1) and set EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID in apps/mobile/.env."
    )
  }
  return "Google sign-in is only available on iOS and Android builds."
}
