import { clearGuestChatStorage } from "@/lib/chat"
import { markExplicitSignOut } from "@/lib/explicit-sign-out"
import { writeFeelingSearchEnabled } from "@/lib/feeling-search"

/** Providers that signed in through SWA `/.auth/*` and need platform logout. */
const EASY_AUTH_LOGOUT_PROVIDERS = new Set(["aad", "entra", "azureactivedirectory"])

function providerUsesDirectOAuth(identityProvider: string) {
  const lower = identityProvider.toLowerCase()
  if (lower === "google") {
    return Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim())
  }
  if (lower === "facebook") {
    return Boolean(process.env.NEXT_PUBLIC_FACEBOOK_APP_ID?.trim())
  }
  return false
}

export function isEasyAuthProvider(identityProvider?: string) {
  if (!identityProvider) return false
  return EASY_AUTH_LOGOUT_PROVIDERS.has(identityProvider.toLowerCase())
    || identityProvider.toLowerCase() === "google"
    || identityProvider.toLowerCase() === "facebook"
}

export function usesEasyAuthLogout(identityProvider?: string) {
  if (!identityProvider) return false
  const lower = identityProvider.toLowerCase()
  if (EASY_AUTH_LOGOUT_PROVIDERS.has(lower)) return true
  if (lower === "google" || lower === "facebook") {
    return !providerUsesDirectOAuth(lower)
  }
  return false
}

export function clearSignOutLocalState() {
  clearGuestChatStorage()
  writeFeelingSearchEnabled(false)
}

/** SWA expects a same-origin absolute URL for post-sign-out redirect (relative "/" is unreliable). */
export function easyAuthLogoutHref(returnPath = "/") {
  const path = returnPath.startsWith("/") ? returnPath : `/${returnPath}`
  const redirect = `${window.location.origin}${path}`
  return `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent(redirect)}`
}

export async function signOutMember(identityProvider?: string) {
  clearSignOutLocalState()
  markExplicitSignOut()

  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"
  const easyAuthLogout = authEnabled && usesEasyAuthLogout(identityProvider)

  if (easyAuthLogout) {
    void fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {})
    window.location.assign("/api/auth/sign-out")
    return
  }

  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
  } catch {
    // Continue with navigation even if the cookie clear request fails.
  }

  window.location.assign("/?signedOut=1")
}
