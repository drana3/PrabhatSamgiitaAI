const APP_SCHEME = "prabhatai"
export const APP_PACKAGE_ID = "net.prabhatasamgiita.ai"

/** Stable redirect URI registered in Azure, Google Cloud, and Facebook. */
export function oauthRedirectHint(path: string) {
  return `${APP_SCHEME}://${path}`
}

/** Reversed Google client ID used as the iOS/Android OAuth redirect scheme. */
export function googleReversedClientId(clientId: string) {
  const trimmed = clientId.trim()
  if (!trimmed.endsWith(".apps.googleusercontent.com")) return ""
  const prefix = trimmed.replace(/\.apps\.googleusercontent\.com$/, "")
  return `com.googleusercontent.apps.${prefix}`
}

/**
 * Redirect URI Google expects for native OAuth clients.
 * Uses the reversed client-id scheme (required for Android; also valid on iOS).
 */
export function googleNativeRedirectUri(clientId?: string) {
  const reversed = clientId?.trim() ? googleReversedClientId(clientId) : ""
  if (reversed) return `${reversed}:/oauthredirect`
  return `${APP_PACKAGE_ID}:/oauthredirect`
}

export const OAUTH_APP_SCHEME = APP_SCHEME
