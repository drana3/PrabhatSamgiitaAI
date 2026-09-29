import { clearGuestChatStorage } from "@/lib/chat"
import { writeFeelingSearchEnabled } from "@/lib/feeling-search"

/** Providers handled by Azure Static Web Apps / Container Apps `/.auth/*` routes. */
const EASY_AUTH_PROVIDERS = new Set(["aad", "entra", "azureactivedirectory", "google", "facebook"])

export function isEasyAuthProvider(identityProvider?: string) {
  if (!identityProvider) return false
  return EASY_AUTH_PROVIDERS.has(identityProvider.toLowerCase())
}

export function clearSignOutLocalState() {
  clearGuestChatStorage()
  writeFeelingSearchEnabled(false)
}

/** SWA expects a same-origin absolute URL for post-sign-out redirect (relative "/" is unreliable). */
export function easyAuthLogoutHref(returnPath = "/signin?signedOut=1") {
  const path = returnPath.startsWith("/") ? returnPath : `/${returnPath}`
  const redirect = `${window.location.origin}${path}`
  return `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent(redirect)}`
}

export async function signOutMember(identityProvider?: string) {
  clearSignOutLocalState()

  const usesEasyAuth =
    process.env.NEXT_PUBLIC_AUTH_ENABLED === "true" && isEasyAuthProvider(identityProvider)

  if (usesEasyAuth) {
    void fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {})
    window.location.assign(easyAuthLogoutHref("/signin?signedOut=1"))
    return
  }

  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
  } catch {
    // Continue with navigation even if the cookie clear request fails.
  }

  window.location.assign("/signin?signedOut=1")
}
