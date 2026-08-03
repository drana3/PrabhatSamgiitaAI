import type { MemberProfile } from "@prabhat/core"

import { api } from "@/lib/client"
import { memberAuthAvailable } from "@/lib/memberAuth"
import { microsoftAuthConfigured, signInWithMicrosoft, getMicrosoftRedirectUri } from "@/lib/msal"
import { buildClientPrincipal } from "@/lib/principal"
import { useAuthStore } from "@/stores/authStore"
import { usePreferencesStore } from "@/stores/preferencesStore"

export { microsoftAuthConfigured, getMicrosoftRedirectUri }

async function hydrateFromSession() {
  const session = await api.fetchMemberSession()
  if (!session.authenticated) {
    return { ok: false as const, memberBackend: false }
  }
  const profile = session as MemberProfile
  useAuthStore.getState().applyMemberSession({
    displayName: profile.display_name,
    email: profile.email ?? null,
    memberId: profile.id,
    isAdmin: profile.is_admin,
    memberBackend: true,
    identityProvider: profile.identity_provider || "aad",
  })
  usePreferencesStore.getState().setSavedFromNumbers(profile.favorite_song_numbers ?? [])
  return { ok: true as const, memberBackend: true, profile }
}

/**
 * Sign in with Microsoft when Azure client ID is configured; otherwise use the
 * preview identity and hydrate member session when MEMBER_PROXY_KEY is available.
 */
export async function signInMember(options?: { preferPreview?: boolean }) {
  const preferPreview = options?.preferPreview === true || !microsoftAuthConfigured()

  if (!preferPreview) {
    const identity = await signInWithMicrosoft()
    // Temporarily set auth so getAuthHeaders can mint principal for this identity.
    useAuthStore.getState().applyMemberSession({
      displayName: identity.displayName,
      email: identity.email,
      memberId: identity.id,
      memberBackend: false,
      identityProvider: "aad",
    })
  } else {
    useAuthStore.getState().setMode("signed_in")
  }

  if (!memberAuthAvailable()) {
    return {
      ok: true as const,
      memberBackend: false,
      message:
        "Signed in on this device. Add EXPO_PUBLIC_MEMBER_PROXY_KEY (same as website MEMBER_PROXY_KEY) to sync favorites, quiz, and chat memory.",
    }
  }

  const hydrated = await hydrateFromSession()
  if (!hydrated.ok) {
    return {
      ok: true as const,
      memberBackend: false,
      message:
        "Signed in locally. Member API session could not load — confirm MEMBER_PROXY_KEY and network.",
    }
  }
  return {
    ok: true as const,
    memberBackend: true,
    message: "Signed in and synced with your Prabhat Samgiita member session.",
  }
}

export function previewPrincipalForTests(email: string) {
  return buildClientPrincipal(email, email)
}
