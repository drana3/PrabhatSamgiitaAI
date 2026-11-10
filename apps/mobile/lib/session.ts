import type { MemberProfile } from "@prabhat/core"
import { Platform } from "react-native"

import { api } from "@/lib/client"
import { googleAuthConfigured, signInWithGoogle, signOutWithGoogle } from "@/lib/googleAuth"
import { loginWithEmail, registerWithEmail } from "@/lib/localAuth"
import { memberAuthAvailable } from "@/lib/memberAuth"
import {
  clearMemberTokens,
  exchangeProviderProof,
  memberSessionBaseUrl,
  revokeMemberSession,
  type ProviderProof,
} from "@/lib/memberSession"
import {
  microsoftAuthConfigured,
  signInWithMicrosoft,
  signOutWithMicrosoft,
  getMicrosoftRedirectUri,
} from "@/lib/msal"
import { subjectFromPrincipal } from "@/lib/oauthIdentity"
import { buildClientPrincipal } from "@/lib/principal"
import "@/lib/account/ownership"
import { mergeGuestKiirtanSaves } from "@/lib/guest/mergeKiirtanSaves"
import { wipeLocalUserData } from "@/lib/account/wipeLocalUserData"
import { hydrateLocalMemberEmail, resolveMemberEmail } from "@/lib/memberEmail"
import { memberPhoneRequired } from "@/lib/memberPhone"
import { nameIsMissing } from "@/lib/profile/validate"
import { useAuthStore } from "@/stores/authStore"
import { useChatStore } from "@/stores/chatStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { useProfileStore } from "@/stores/profileStore"

export { microsoftAuthConfigured, getMicrosoftRedirectUri }
export { googleAuthConfigured } from "@/lib/googleAuth"

async function hydrateFromSession() {
  const epoch = useAuthStore.getState().sessionEpoch
  const session = await api.fetchMemberSession()
  // Sign-out (email, Google, Microsoft, …) can finish while this request is in flight.
  if (
    useAuthStore.getState().sessionEpoch !== epoch ||
    useAuthStore.getState().mode !== "signed_in"
  ) {
    return { ok: false as const, memberBackend: false }
  }
  if (!session.authenticated) {
    const auth = useAuthStore.getState()
    if (auth.mode !== "signed_in" || auth.sessionEpoch !== epoch) {
      return { ok: false as const, memberBackend: false }
    }
    useAuthStore.getState().applyMemberSession({
      displayName: auth.displayName,
      email: auth.email,
      memberId: auth.memberId,
      // the server did not confirm this member, so never keep an admin flag from before
      isAdmin: false,
      memberBackend: false,
      identityProvider: auth.identityProvider,
    })
    return { ok: false as const, memberBackend: false }
  }
  if (
    useAuthStore.getState().sessionEpoch !== epoch ||
    useAuthStore.getState().mode !== "signed_in"
  ) {
    return { ok: false as const, memberBackend: false }
  }
  const profile = session as MemberProfile
  const existingSubject = useAuthStore.getState().memberId
  const resolvedEmail = await resolveMemberEmail({
    email: profile.email ?? useAuthStore.getState().email,
    memberId: existingSubject,
    identityProvider: profile.identity_provider || useAuthStore.getState().identityProvider,
  })
  useAuthStore.getState().applyMemberSession({
    displayName: profile.display_name,
    email: resolvedEmail,
    memberId: existingSubject,
    isAdmin: profile.is_admin,
    memberBackend: true,
    identityProvider: profile.identity_provider || useAuthStore.getState().identityProvider || "aad",
  })
  if (
    useAuthStore.getState().sessionEpoch !== epoch ||
    useAuthStore.getState().mode !== "signed_in"
  ) {
    // applyMemberSession raced a sign-out — force guest again.
    useAuthStore.getState().signOut()
    usePreferencesStore.getState().resetAfterSignOut()
    return { ok: false as const, memberBackend: false }
  }
  usePreferencesStore.getState().setSavedFromNumbers(profile.favorite_song_numbers ?? [])
  return { ok: true as const, memberBackend: true, profile }
}

async function syncMemberData() {
  await hydrateLocalMemberEmail()
  const hydrated = await hydrateFromSession()
  if (!hydrated.ok) return hydrated
  if (useAuthStore.getState().mode !== "signed_in") {
    return { ok: false as const, memberBackend: false }
  }
  await usePreferencesStore.getState().hydrateFavoritesFromServer()
  return hydrated
}

function exchangeProvider(identityProvider: string): ProviderProof["provider"] | null {
  return identityProvider === "google" ||
    identityProvider === "apple" ||
    identityProvider === "aad"
    ? identityProvider
    : null
}

function deviceLabel() {
  return `${Platform.OS} app`
}

async function finishSignIn(input: {
  displayName: string
  email: string | null
  memberId: string
  identityProvider: string
  /** the provider's picture (Google), kept unless the person chose their own */
  photoUrl?: string | null
  /** the provider's signed proof; the server trades it for our session tokens before any member request */
  proof?: Omit<ProviderProof, "provider" | "deviceLabel">
}) {
  // First thing: trade the provider's proof for session tokens, so every request after this is signed.
  // When the server cannot do it (offline, not set up yet) the older path below still works.
  if (input.proof) {
    const provider = exchangeProvider(input.identityProvider)
    if (provider) {
      await exchangeProviderProof(memberSessionBaseUrl(), { ...input.proof, provider, deviceLabel: deviceLabel() })
    } else {
      await clearMemberTokens()
    }
  }
  useAuthStore.getState().applyMemberSession({
    displayName: input.displayName,
    email: input.email,
    memberId: input.memberId,
    memberBackend: false,
    identityProvider: input.identityProvider,
  })
  // The Kiirtans saved as a guest join the account's (the songs follow in syncMemberData): docs/guest-saves.md
  mergeGuestKiirtanSaves()
  if (input.photoUrl) useProfileStore.getState().setProviderPhoto(input.photoUrl)
  // The name comes from the provider; when it gave none (Apple only gives it once), the page asks once.
  const needsName = nameIsMissing(input.displayName, input.email)

  if (!memberAuthAvailable()) {
    return {
      ok: true as const,
      memberBackend: false,
      needsName,
      message:
        "Signed in on this device. Favorites, quiz, and admin status will sync after you install an app update that includes member sync.",
    }
  }

  const hydrated = await syncMemberData()
  if (!hydrated.ok) {
    return {
      ok: true as const,
      memberBackend: false,
      needsName,
      message:
        "Signed in locally. We could not reach your member account — check your connection and try again.",
    }
  }
  if (memberPhoneRequired(hydrated.profile, input.identityProvider)) {
    return {
      ok: true as const,
      memberBackend: true,
      needsPhone: true,
      needsName,
      message: "Add your mobile number to finish setting up your account.",
    }
  }
  return {
    ok: true as const,
    memberBackend: true,
    needsName,
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

/** Clears local auth for every login type; provider SSO logout is best-effort and non-blocking. */
export async function signOutMember() {
  const before = useAuthStore.getState()
  const provider = before.identityProvider
  const accountId = useChatStore.getState().getAccountId(before.mode, before.email, before.memberId)
  // Always clear local session first (email/password, Apple, Google, Microsoft).
  // In-flight Profile/AppState member sync must not revive the session after the alert.
  useAuthStore.getState().signOut()
  usePreferencesStore.getState().resetAfterSignOut()
  // Tokens leave this phone at once; the server is told in the background (best effort).
  void revokeMemberSession(memberSessionBaseUrl())
  // The account's data leaves the phone (see lib/account/wipeLocalUserData.ts); the sign-out itself never waits on it.
  void wipeLocalUserData(accountId)

  // Do not await browser/SSO UI — that delayed the "Signed out" alert and raced sync.
  void (async () => {
    try {
      if (provider === "aad" && microsoftAuthConfigured()) {
        await signOutWithMicrosoft()
      } else if (provider === "google" && googleAuthConfigured()) {
        await signOutWithGoogle()
      }
    } catch {
      // Local session already cleared.
    }
  })()
}

/** Sign out and mark welcome incomplete so callers can route to `/welcome`. */
export async function completeMemberSignOut() {
  await signOutMember()
  useAuthStore.getState().resetWelcome()
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
    proof: { idToken: identity.idToken },
  })
}

export async function signInWithGoogleAccount() {
  const identity = await signInWithGoogle()
  return finishSignIn({
    displayName: identity.displayName,
    email: identity.email,
    memberId: identity.id,
    identityProvider: identity.provider,
    photoUrl: identity.photoUrl,
    proof: { idToken: identity.idToken },
  })
}

export async function signInWithAppleAccount() {
  const { signInWithApple } = await import("@/lib/appleAuth")
  const identity = await signInWithApple()
  return finishSignIn({
    displayName: identity.displayName,
    email: identity.email,
    memberId: identity.id,
    identityProvider: identity.provider,
    proof: { idToken: identity.idToken },
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
) {
  const session = await registerWithEmail({
    email,
    password,
    displayName,
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
