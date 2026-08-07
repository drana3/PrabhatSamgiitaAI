import { clearGuestChatStorage } from "@/lib/chat"

const EASY_AUTH_PROVIDERS = new Set(["aad", "google", "facebook"])

export async function signOutMember(identityProvider?: string) {
  clearGuestChatStorage()
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
