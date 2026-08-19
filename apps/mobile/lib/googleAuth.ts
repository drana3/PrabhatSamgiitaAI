import * as AuthSession from "expo-auth-session"
import * as WebBrowser from "expo-web-browser"
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin"
import { Platform } from "react-native"

import type { OAuthIdentity } from "@/lib/oauthIdentity"
import { identityFromIdToken } from "@/lib/msalToken"
import {
  googleAuthConfigured,
  googleIosClientId,
  googleSetupHint,
  googleWebClientId,
} from "@/lib/googleOAuthConfig"
import { oauthRedirectHint } from "@/lib/oauthRedirectUri"

export { googleAuthConfigured, googleSetupHint } from "@/lib/googleOAuthConfig"

WebBrowser.maybeCompleteAuthSession()

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
}

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

function shouldUseBrowserFallback(error: unknown) {
  const code = (error as { code?: string })?.code
  const message = error instanceof Error ? error.message : String(error ?? "")
  return (
    code === "10" ||
    code === statusCodes.DEVELOPER_ERROR ||
    /DEVELOPER_ERROR/i.test(message)
  )
}

async function signInWithGoogleBrowser(): Promise<OAuthIdentity> {
  const clientId = googleWebClientId()
  if (!clientId) {
    throw new Error("Google browser sign-in is not configured for this platform.")
  }

  const redirectUri = oauthRedirectHint("auth/google")
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ["openid", "profile", "email"],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: { prompt: "select_account" },
  })

  await request.makeAuthUrlAsync(GOOGLE_DISCOVERY)
  const result = await request.promptAsync(GOOGLE_DISCOVERY, { showInRecents: true })
  if (result.type !== "success" || !result.params.code) {
    if (result.type === "dismiss") throw new Error("Sign-in was cancelled.")
    throw new Error("Google sign-in didn’t finish. Try again.")
  }

  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
      extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
    },
    GOOGLE_DISCOVERY,
  )

  if (!tokenResult.idToken) {
    throw new Error("Google did not return an identity token.")
  }
  const identity = identityFromIdToken(tokenResult.idToken)
  if (!identity?.id) {
    throw new Error("Could not read your Google account profile.")
  }

  return {
    id: identity.id,
    email: identity.email,
    displayName: identity.displayName,
    provider: "google",
  }
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
    if (shouldUseBrowserFallback(error)) {
      if (Platform.OS === "android") {
        try {
          return await signInWithGoogleBrowser()
        } catch {
          throw new Error(
            "Google sign-in failed on this build. If you installed from Play Store, add the Play App signing SHA-1 fingerprint to your Google Cloud Android OAuth client (Setup → App signing in Play Console).",
          )
        }
      }
      throw new Error(
        "Google sign-in failed. Confirm the iOS OAuth client in Google Cloud uses bundle ID net.prabhatasamgiita.ai and matches EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in this build.",
      )
    }
    throw new Error(googleSignInErrorMessage(error))
  }
}
