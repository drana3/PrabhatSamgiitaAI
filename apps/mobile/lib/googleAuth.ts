import * as Application from "expo-application"
import * as AuthSession from "expo-auth-session"
import { discovery } from "expo-auth-session/providers/google"
import * as WebBrowser from "expo-web-browser"

import type { OAuthIdentity } from "@/lib/oauthIdentity"
import {
  googleAuthConfigured,
  googleNativeClientId,
  googleRedirectUriForClient,
  googleSetupHint,
} from "@/lib/googleOAuthConfig"

WebBrowser.maybeCompleteAuthSession()

export { googleAuthConfigured, googleSetupHint } from "@/lib/googleOAuthConfig"

function resolveGoogleClientId() {
  return googleNativeClientId()
}

function googleOAuthErrorMessage(
  result: AuthSession.AuthSessionResult,
  clientId: string,
  redirectUri: string,
) {
  if (result.type === "dismiss") return "Sign-in was cancelled."
  const oauthError = result.params?.error_description || result.params?.error
  if (typeof oauthError === "string") {
    if (/redirect_uri|invalid_request|client_id/i.test(oauthError)) {
      const suffix = clientId.endsWith(".apps.googleusercontent.com") ? "" : " (check iOS client ID)"
      return `${oauthError}${suffix}\nRedirect: ${redirectUri}\n${googleSetupHint()}`
    }
    return oauthError
  }
  return "Google sign-in didn’t finish. Try again."
}

export async function signInWithGoogle(): Promise<OAuthIdentity> {
  const clientId = resolveGoogleClientId()
  if (!clientId) {
    throw new Error(googleSetupHint())
  }

  const redirectUri =
    Application.applicationId?.trim()
      ? `${Application.applicationId}:/oauthredirect`
      : googleRedirectUriForClient(clientId)
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ["openid", "profile", "email"],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: { prompt: "select_account" },
  })

  await request.makeAuthUrlAsync(discovery)
  const result = await request.promptAsync(discovery, {
    showInRecents: true,
    preferEphemeralSession: true,
  })
  if (result.type !== "success" || !result.params.code) {
    throw new Error(googleOAuthErrorMessage(result, clientId, redirectUri))
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
  if (!accessToken) throw new Error("Google sign-in did not return an access token.")

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
