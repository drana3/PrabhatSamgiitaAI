import { clearGuestChatStorage } from "@/lib/chat"
import { writeFeelingSearchEnabled } from "@/lib/feeling-search"

/** Microsoft sign-in on Azure Static Web Apps / Container Apps Easy Auth. */
const EASY_AUTH_PROVIDERS = new Set(["aad"])

/** SWA expects a same-origin absolute URL for post-sign-out redirect (relative "/" is unreliable). */
export function easyAuthLogoutHref(returnPath = "/") {
  const path = returnPath.startsWith("/") ? returnPath : `/${returnPath}`
  const redirect = `${window.location.origin}${path}`
  return `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent(redirect)}`
}

export async function signOutMember(identityProvider?: string) {
  clearGuestChatStorage()
  // Feeling search stays off by default for the next session.
  writeFeelingSearchEnabled(false)

  const usesEasyAuth =
    process.env.NEXT_PUBLIC_AUTH_ENABLED === "true" &&
    identityProvider &&
    EASY_AUTH_PROVIDERS.has(identityProvider)

  if (usesEasyAuth) {
    void fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {})
    window.location.replace(easyAuthLogoutHref("/"))
    return
  }

  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
  } catch {
    // Continue with navigation even if the cookie clear request fails.
  }

  window.location.replace("/")
}
