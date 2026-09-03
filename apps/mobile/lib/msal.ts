import * as AuthSession from "expo-auth-session"
import * as WebBrowser from "expo-web-browser"
import Constants from "expo-constants"

import { identityFromIdToken, type MicrosoftIdentity } from "@/lib/msalToken"
import { MICROSOFT_REDIRECT_PATH } from "@/lib/msalRedirect"
import { makeOAuthRedirectUri, redirectUriMismatchMessage } from "@/lib/oauthRedirect"

export type { MicrosoftIdentity }
export { identityFromIdToken } from "@/lib/msalToken"
export { microsoftRedirectHint } from "@/lib/msalRedirect"

WebBrowser.maybeCompleteAuthSession()

function azureConfig() {
  const clientId =
    process.env.EXPO_PUBLIC_AZURE_CLIENT_ID?.trim() ||
    (Constants.expoConfig?.extra?.azureClientId as string | undefined)?.trim()
  const tenantId =
    process.env.EXPO_PUBLIC_AZURE_TENANT_ID?.trim() ||
    (Constants.expoConfig?.extra?.azureTenantId as string | undefined)?.trim() ||
    "common"
  return { clientId, tenantId }
}

/** Redirect URI that must be registered on the Entra app (prabhatai-members). */
export function getMicrosoftRedirectUri() {
  return makeOAuthRedirectUri({ path: MICROSOFT_REDIRECT_PATH })
}

export function microsoftAuthConfigured() {
  return Boolean(azureConfig().clientId)
}

/** After local sign-out, force the next Microsoft login to ask for credentials (no silent SSO). */
let preferLoginPrompt = false

export function markMicrosoftLoginRequired() {
  preferLoginPrompt = true
}

/**
 * Best-effort Entra logout so the next sign-in is not completed by SSO cookie alone.
 * Cancel / dismiss is ignored — local app session is cleared separately.
 */
export async function signOutWithMicrosoft(): Promise<void> {
  preferLoginPrompt = true
  const { clientId, tenantId } = azureConfig()
  if (!clientId) return

  const redirectUri = getMicrosoftRedirectUri()
  const logoutUrl =
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`

  try {
    await WebBrowser.openAuthSessionAsync(logoutUrl, redirectUri)
  } catch {
    // Keep going; local sign-out still applies.
  }
}

/**
 * Opens Microsoft Entra ID (Azure AD) login when EXPO_PUBLIC_AZURE_CLIENT_ID is set.
 * Register `prabhatai://auth` (or the URI from getMicrosoftRedirectUri) as a Mobile/desktop redirect.
 */
export async function signInWithMicrosoft(): Promise<MicrosoftIdentity> {
  const { clientId, tenantId } = azureConfig()
  if (!clientId) {
    throw new Error("Microsoft sign-in is not configured. Set EXPO_PUBLIC_AZURE_CLIENT_ID.")
  }

  const redirectUri = getMicrosoftRedirectUri()
  const discovery = {
    authorizationEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
  }

  const prompt = preferLoginPrompt ? "login" : "select_account"
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ["openid", "profile", "email", "offline_access"],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: { prompt },
  })

  await request.makeAuthUrlAsync(discovery)
  const result = await request.promptAsync(discovery, { showInRecents: true })
  if (result.type !== "success" || !result.params.code) {
    if (result.type === "dismiss") throw new Error("Sign-in was cancelled.")
    const oauthError = result.params?.error_description || result.params?.error
    if (typeof oauthError === "string" && /redirect_uri|AADSTS50011/i.test(oauthError)) {
      throw new Error(redirectUriMismatchMessage("Microsoft"))
    }
    throw new Error(
      "Microsoft sign-in didn’t finish. Try again, or continue without an account.",
    )
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

  if (!tokenResult.idToken) {
    throw new Error("Microsoft did not return an identity token.")
  }
  const identity = identityFromIdToken(tokenResult.idToken)
  if (!identity) throw new Error("Could not read your Microsoft account profile.")
  preferLoginPrompt = false
  return identity
}
