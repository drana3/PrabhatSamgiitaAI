import * as AuthSession from "expo-auth-session"
import Constants from "expo-constants"

import { OAUTH_APP_SCHEME, oauthRedirectHint } from "@/lib/oauthRedirectUri"

/** True when running inside the Expo Go app (custom URL schemes are not registered). */
export function isExpoGoClient() {
  return Constants.appOwnership === "expo"
}

type OAuthRedirectOptions = {
  /** Path after the scheme, e.g. `auth` or `auth/google`. */
  path: string
}

/** Redirect URI sent to the OAuth provider. */
export function makeOAuthRedirectUri({ path }: OAuthRedirectOptions) {
  const native = oauthRedirectHint(path)
  return AuthSession.makeRedirectUri({
    scheme: OAUTH_APP_SCHEME,
    path,
    native,
  })
}

export function expoGoOAuthMessage() {
  if (!isExpoGoClient()) return null
  return (
    "Microsoft and Google sign-in need a development build (npm run android from apps/mobile). " +
    "Expo Go cannot use the prabhatai:// redirect registered in Azure and Google Cloud."
  )
}

export function redirectUriMismatchMessage(provider: string) {
  if (isExpoGoClient()) {
    return (
      `${provider} rejected the redirect URI because Expo Go uses exp://… instead of prabhatai://. ` +
      "Run npm run android to install a dev build, or sign in with email."
    )
  }
  return `${provider} sign-in failed. Confirm prabhatai:// is registered as a redirect URI for this app.`
}
