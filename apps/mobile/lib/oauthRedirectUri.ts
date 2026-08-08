const APP_SCHEME = "prabhatai"

/** Stable redirect URI registered in Azure, Google Cloud, and Facebook. */
export function oauthRedirectHint(path: string) {
  return `${APP_SCHEME}://${path}`
}

export const OAUTH_APP_SCHEME = APP_SCHEME
