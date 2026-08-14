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
    throw new Error(googleSignInErrorMessage(error))
  }
}
