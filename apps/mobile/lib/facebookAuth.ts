import * as AuthSession from "expo-auth-session"
import * as WebBrowser from "expo-web-browser"
import Constants from "expo-constants"

import type { OAuthIdentity } from "@/lib/oauthIdentity"

WebBrowser.maybeCompleteAuthSession()

const discovery = {
  authorizationEndpoint: "https://www.facebook.com/v19.0/dialog/oauth",
  tokenEndpoint: "https://graph.facebook.com/v19.0/oauth/access_token",
}

function facebookAppId() {
  return (
    process.env.EXPO_PUBLIC_FACEBOOK_APP_ID?.trim() ||
    (Constants.expoConfig?.extra?.facebookAppId as string | undefined)?.trim() ||
    ""
  )
}

export function facebookAuthConfigured() {
  return Boolean(facebookAppId())
}

export function getFacebookRedirectUri() {
  return AuthSession.makeRedirectUri({ scheme: "prabhatai", path: "auth/facebook" })
}

export async function signInWithFacebook(): Promise<OAuthIdentity> {
  const clientId = facebookAppId()
  if (!clientId) {
    throw new Error("Facebook sign-in is not configured. Set EXPO_PUBLIC_FACEBOOK_APP_ID.")
  }

  const redirectUri = getFacebookRedirectUri()
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ["public_profile", "email"],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: false,
  })

  await request.makeAuthUrlAsync(discovery)
  const result = await request.promptAsync(discovery, { showInRecents: true })
  if (result.type !== "success" || !result.params.code) {
    if (result.type === "dismiss") throw new Error("Sign-in was cancelled.")
    throw new Error("Facebook sign-in didn’t finish. Try again.")
  }

  const tokenResult = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code: result.params.code,
      redirectUri,
    },
    discovery,
  )

  const accessToken = tokenResult.accessToken
  if (!accessToken) throw new Error("Facebook did not return an access token.")

  const profile = (await fetch(
    `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`,
  ).then((response) => response.json())) as { id?: string; email?: string; name?: string }

  if (!profile.id) throw new Error("Could not read your Facebook account profile.")
  return {
    id: profile.id,
    email: profile.email ?? null,
    displayName: profile.name || profile.email || "Facebook member",
    provider: "facebook",
  }
}
