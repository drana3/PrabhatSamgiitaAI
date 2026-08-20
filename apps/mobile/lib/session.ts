import type { MemberProfile } from "@prabhat/core"

import { api } from "@/lib/client"
import { signInWithFacebook } from "@/lib/facebookAuth"
import { signInWithGoogle } from "@/lib/googleAuth"
import { loginWithEmail, registerWithEmail } from "@/lib/localAuth"
import { memberAuthAvailable } from "@/lib/memberAuth"
import {
  microsoftAuthConfigured,
  signInWithMicrosoft,
  signOutWithMicrosoft,
  getMicrosoftRedirectUri,
} from "@/lib/msal"
import { subjectFromPrincipal } from "@/lib/oauthIdentity"
import { buildClientPrincipal } from "@/lib/principal"
import { useAuthStore } from "@/stores/authStore"
import { usePreferencesStore } from "@/stores/preferencesStore"

export { microsoftAuthConfigured, getMicrosoftRedirectUri }
export { googleAuthConfigured } from "@/lib/googleAuth"
export { facebookAuthConfigured } from "@/lib/facebookAuth"

async function hydrateFromSession() {
  const session = await api.fetchMemberSession()
  if (!session.authenticated) {
    useAuthStore.getState().applyMemberSession({
      displayName: useAuthStore.getState().displayName,
      email: useAuthStore.getState().email,
      memberId: useAuthStore.getState().memberId,
      isAdmin: useAuthStore.getState().isAdmin,
      memberBackend: false,
      identityProvider: useAuthStore.getState().identityProvider,
    })
    return { ok: false as const, memberBackend: false }
  }
  const profile = session as MemberProfile
  const existingSubject = useAuthStore.getState().memberId
  useAuthStore.getState().applyMemberSession({
    displayName: profile.display_name,
    email: profile.email ?? useAuthStore.getState().email,
    memberId: existingSubject,
    isAdmin: profile.is_admin,
    memberBackend: true,
    identityProvider: profile.identity_provider || useAuthStore.getState().identityProvider || "aad",
  })
  usePreferencesStore.getState().setSavedFromNumbers(profile.favorite_song_numbers ?? [])
  return { ok: true as const, memberBackend: true, profile }
}

async function syncMemberData() {
  const hydrated = await hydrateFromSession()
  if (!hydrated.ok) return hydrated
  await usePreferencesStore.getState().hydrateFavoritesFromServer()
  return hydrated
}

async function finishSignIn(input: {
  displayName: string
  email: string | null
  memberId: string
  identityProvider: string
}) {
  useAuthStore.getState().applyMemberSession({
    displayName: input.displayName,
    email: input.email,
    memberId: input.memberId,
    memberBackend: false,
    identityProvider: input.identityProvider,
  })

  if (!memberAuthAvailable()) {
    return {
      ok: true as const,
      memberBackend: false,
      message:
        "Signed in on this device. Favorites, quiz, and admin status will sync after you install an app update that includes member sync.",
    }
  }

  const hydrated = await syncMemberData()
  if (!hydrated.ok) {
    return {
      ok: true as const,
      memberBackend: false,
      message:
        "Signed in locally. We could not reach your member account — check your connection and try again.",
    }
  }
  if (hydrated.profile.phone_required) {
    return {
      ok: true as const,
      memberBackend: true,
      needsPhone: true,
      message: "Add your mobile number to finish setting up your account.",
    }
  }
  return {
    ok: true as const,
    memberBackend: true,
    message: "Signed in and synced with your Prabhat Samgiita member session.",
  }
}

export async function refreshMemberSession() {
  const { mode } = useAuthStore.getState()
  if (mode !== "signed_in" || !memberAuthAvailable()) {
    return { ok: false as const, memberBackend: false }
  }
  return syncMemberData()
}

/** Clears local auth + prefs; ends Microsoft SSO when the active provider is Entra. */
export async function signOutMember() {
  const provider = useAuthStore.getState().identityProvider
  if (provider === "aad" && microsoftAuthConfigured()) {
    await signOutWithMicrosoft()
  }
  useAuthStore.getState().signOut()
  usePreferencesStore.getState().resetAfterSignOut()
}

export async function signInMember() {
  if (!microsoftAuthConfigured()) {
    throw new Error("Microsoft sign-in is not configured in this build.")
  }
  const identity = await signInWithMicrosoft()
  return finishSignIn({
    displayName: identity.displayName,
    email: identity.email,
    memberId: identity.id,
    identityProvider: "aad",
  })
}

export async function signInWithGoogleAccount() {
  const identity = await signInWithGoogle()
  return finishSignIn({
    displayName: identity.displayName,
    email: identity.email,
    memberId: identity.id,
    identityProvider: identity.provider,
  })
}

export async function signInWithFacebookAccount() {
  const identity = await signInWithFacebook()
  return finishSignIn({
    displayName: identity.displayName,
    email: identity.email,
    memberId: identity.id,
    identityProvider: identity.provider,
  })
}

export async function signInWithEmailPassword(email: string, password: string) {
  const session = await loginWithEmail({ email, password })
  return finishSignIn({
    displayName: session.display_name,
    email: session.email,
    memberId: subjectFromPrincipal(session.client_principal),
    identityProvider: session.identity_provider,
  })
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
  displayName: string,
  phoneCountryCode: string,
  phoneNumber: string,
) {
  const session = await registerWithEmail({
    email,
    password,
    displayName,
    phoneCountryCode,
    phoneNumber,
  })
  return finishSignIn({
    displayName: session.display_name,
    email: session.email,
    memberId: subjectFromPrincipal(session.client_principal),
    identityProvider: session.identity_provider,
  })
}

export function previewPrincipalForTests(email: string) {
  return buildClientPrincipal(email, email)
}
