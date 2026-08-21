import * as WebBrowser from "expo-web-browser"
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin"
import { Platform } from "react-native"

import type { OAuthIdentity } from "@/lib/oauthIdentity"
import {
  googleAuthConfigured,
  googleIosClientId,
  googleSetupHint,
  googleWebClientId,
} from "@/lib/googleOAuthConfig"

export { googleAuthConfigured, googleSetupHint } from "@/lib/googleOAuthConfig"

WebBrowser.maybeCompleteAuthSession()

let configured = false

function ensureGoogleSignInConfigured() {
  if (configured) return
  const webClientId = googleWebClientId()
  if (!webClientId) {
    throw new Error(
      "Google sign-in needs EXPO_PUBLIC_GOOGLE_CLIENT_ID (Web OAuth client from Google Cloud).",
    )
  }
  GoogleSignin.configure({
    webClientId,
    iosClientId: Platform.OS === "ios" ? googleIosClientId() || undefined : undefined,
    offlineAccess: false,
  })
  configured = true
}

function googleSignInErrorMessage(error: unknown) {
  const code = (error as { code?: string })?.code
  if (code === statusCodes.SIGN_IN_CANCELLED) return "Sign-in was cancelled."
  if (code === statusCodes.IN_PROGRESS) return "Google sign-in is already in progress."
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return "Google Play Services is required for sign-in on this device."
  }
  if (error instanceof Error && error.message) return error.message
  return "Google sign-in didn’t finish. Try again."
}

function isDeveloperConfigError(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = error instanceof Error ? error.message : String(error ?? "")
  return (
    code === "10" ||
    code === statusCodes.DEVELOPER_ERROR ||
    /DEVELOPER_ERROR/i.test(message)
  )
}

const ANDROID_SHA_HINT =
  "Play Store Google Sign-In failed (DEVELOPER_ERROR). Quantum-ready Play App Signing " +
  "uses multiple app-signing keys — add ANY missing SHA-1 as its own Android OAuth client " +
  "in GCP project 495992354696 for package net.prabhatasamgiita.ai: " +
  "upload 29:36:BD:D1:9B:F2:C7:96:13:4C:13:CD:12:8D:E5:B8:21:B2:F7:9D, " +
  "Play classical 0A:CD:27:EE:73:CC:3D:6B:BB:41:9A:F2:7D:45:64:07:67:0B:A6:75, " +
  "Play post-quantum 27:C2:FB:E5:B3:9A:26:33:4D:35:98:3B:0E:4B:4D:B8:71:17:AE:06, " +
  "Play previous 64:1F:F2:68:70:D1:73:F0:6C:8A:F3:43:D9:2B:08:0D:EE:AE:62:40. " +
  "No app rebuild needed. Wait ~10 minutes, uninstall Play build, reinstall, retry."

function developerErrorDetail(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = error instanceof Error ? error.message : String(error ?? "")
  const parts = [code ? `code ${code}` : null, message || null].filter(Boolean)
  return parts.join(": ") || "DEVELOPER_ERROR"
}

/**
 * Native Google Sign-In only. Browser OAuth with a Web client + custom scheme
 * is rejected by Google (“does not comply with Google OAuth 2.0 policy”).
 */
export async function signInWithGoogle(): Promise<OAuthIdentity> {
  if (!googleAuthConfigured()) {
    throw new Error(googleSetupHint())
  }

  ensureGoogleSignInConfigured()

  try {
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    }
    const response = await GoogleSignin.signIn()
    if (response.type !== "success") {
      throw new Error("Sign-in was cancelled.")
    }
    const profile = response.data.user
    if (!profile?.id) {
      throw new Error("Could not read your Google account profile.")
    }
    return {
      id: profile.id,
      email: profile.email ?? null,
      displayName: profile.name || profile.email || "Google member",
      provider: "google",
    }
  } catch (error) {
    if (isDeveloperConfigError(error)) {
      const sdkDetail = developerErrorDetail(error)
      const webClientId = googleWebClientId()
      const webSuffix = webClientId ? webClientId.slice(-24) : "missing"
      if (Platform.OS === "android") {
        throw new Error(
          `${ANDROID_SHA_HINT}\n\nGoogle SDK: ${sdkDetail}\nWeb client suffix: …${webSuffix}`,
        )
      }
      throw new Error(
        "Google sign-in failed. Confirm the iOS OAuth client in Google Cloud uses bundle ID net.prabhatasamgiita.ai and matches EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in this build.",
      )
    }
    throw new Error(googleSignInErrorMessage(error))
  }
}

/** Best-effort Google SDK sign-out so the next login is not silent. */
export async function signOutWithGoogle(): Promise<void> {
  if (!googleAuthConfigured()) return
  try {
    ensureGoogleSignInConfigured()
    await GoogleSignin.signOut()
  } catch {
    // Local app session is cleared separately.
  }
}
