import { clearGuestChatStorage } from "@/lib/chat"
import { writeFeelingSearchEnabled } from "@/lib/feeling-search"

/** Only Microsoft uses Azure Container Apps Easy Auth; Google/Facebook use app cookies. */
const EASY_AUTH_PROVIDERS = new Set(["aad"])

export async function signOutMember(identityProvider?: string) {
  clearGuestChatStorage()
  // Feeling search stays off by default for the next session.
  writeFeelingSearchEnabled(false)
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
  } catch {
    // Continue with navigation even if the cookie clear request fails.
  }

  const usesEasyAuth =
    process.env.NEXT_PUBLIC_AUTH_ENABLED === "true" &&
    identityProvider &&
    EASY_AUTH_PROVIDERS.has(identityProvider)

  if (usesEasyAuth) {
    window.location.href = `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent("/")}`
    return
  }

  window.location.href = "/"
}
