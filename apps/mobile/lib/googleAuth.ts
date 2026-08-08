import * as AuthSession from "expo-auth-session"
import * as WebBrowser from "expo-web-browser"
import Constants from "expo-constants"

import type { OAuthIdentity } from "@/lib/oauthIdentity"
import { makeOAuthRedirectUri, redirectUriMismatchMessage } from "@/lib/oauthRedirect"

WebBrowser.maybeCompleteAuthSession()

const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
}

function googleClientId() {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    (Constants.expoConfig?.extra?.googleClientId as string | undefined)?.trim() ||
    ""
  )
}

export function googleAuthConfigured() {
  return Boolean(googleClientId())
}

export function getGoogleRedirectUri() {
  return makeOAuthRedirectUri({ path: "auth/google" })
}

export async function signInWithGoogle(): Promise<OAuthIdentity> {
  const clientId = googleClientId()
  if (!clientId) {
    throw new Error("Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_CLIENT_ID.")
  }

  const redirectUri = getGoogleRedirectUri()
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ["openid", "profile", "email"],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: { prompt: "select_account" },
  })

  await request.makeAuthUrlAsync(discovery)
  const result = await request.promptAsync(discovery, { showInRecents: true })
  if (result.type !== "success" || !result.params.code) {
    if (result.type === "dismiss") throw new Error("Sign-in was cancelled.")
    const oauthError = result.params?.error_description || result.params?.error
    if (typeof oauthError === "string" && /redirect_uri/i.test(oauthError)) {
      throw new Error(redirectUriMismatchMessage("Google"))
    }
    throw new Error("Google sign-in didn’t finish. Try again.")
  }

  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
      extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
    },
    discovery,
  )

  const accessToken = tokenResult.accessToken
  if (!accessToken) throw new Error("Google did not return an access token.")

  const profile = (await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then((response) => response.json())) as { sub?: string; email?: string; name?: string }

  if (!profile.sub) throw new Error("Could not read your Google account profile.")
  return {
    id: profile.sub,
    email: profile.email ?? null,
    displayName: profile.name || profile.email || "Google member",
    provider: "google",
  }
}
