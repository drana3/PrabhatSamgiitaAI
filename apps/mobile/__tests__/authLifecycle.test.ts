import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => {
  const memory = new Map<string, string>()
  return {
    default: {
      getItem: async (key: string) => memory.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: async (key: string) => {
        memory.delete(key)
      },
      clear: async () => {
        memory.clear()
      },
    },
  }
})

const {
  signInWithMicrosoft,
  signOutWithMicrosoft,
  signInWithGoogle,
  signOutWithGoogle,
  signInWithFacebook,
  loginWithEmail,
  registerWithEmail,
  fetchMemberSession,
  fetchMemberFavorites,
} = vi.hoisted(() => ({
  signInWithMicrosoft: vi.fn(),
  signOutWithMicrosoft: vi.fn(async () => undefined),
  signInWithGoogle: vi.fn(),
  signOutWithGoogle: vi.fn(async () => undefined),
  signInWithFacebook: vi.fn(),
  loginWithEmail: vi.fn(),
  registerWithEmail: vi.fn(),
  fetchMemberSession: vi.fn(),
  fetchMemberFavorites: vi.fn(),
}))

vi.mock("@/lib/msal", () => ({
  microsoftAuthConfigured: () => true,
  signInWithMicrosoft,
  signOutWithMicrosoft,
  getMicrosoftRedirectUri: () => "prabhatai://auth",
}))

vi.mock("@/lib/googleAuth", () => ({
  googleAuthConfigured: () => true,
  signInWithGoogle,
  signOutWithGoogle,
}))

vi.mock("@/lib/facebookAuth", () => ({
  facebookAuthConfigured: () => true,
  signInWithFacebook,
}))

vi.mock("@/lib/localAuth", () => ({
  loginWithEmail,
  registerWithEmail,
}))

vi.mock("@/lib/memberAuth", () => ({
  memberAuthAvailable: () => true,
}))

vi.mock("@/lib/client", () => ({
  api: {
    fetchMemberSession,
    fetchMemberFavorites,
    addMemberFavorite: vi.fn(),
    removeMemberFavorite: vi.fn(),
  },
}))

import { buildClientPrincipal } from "@/lib/principal"
import {
  completeMemberSignOut,
  signInMember,
  signInWithEmailPassword,
  signInWithFacebookAccount,
  signInWithGoogleAccount,
  signOutMember,
  signUpWithEmailPassword,
} from "@/lib/session"
import { useAuthStore } from "@/stores/authStore"
import { usePreferencesStore } from "@/stores/preferencesStore"

function syncedMemberSession(overrides?: Record<string, unknown>) {
  return {
    authenticated: true,
    id: "11111111-1111-1111-1111-111111111111",
    display_name: "Member",
    email: "member@example.com",
    identity_provider: "aad",
    personalization_enabled: true,
    is_admin: false,
    favorite_song_numbers: [] as number[],
    ...overrides,
  }
}

function assertGuestAfterSignOut() {
  const auth = useAuthStore.getState()
  expect(auth.mode).toBe("guest")
  expect(auth.email).toBeNull()
  expect(auth.memberId).toBeNull()
  expect(auth.identityProvider).toBeNull()
  expect(auth.isAdmin).toBe(false)
  expect(auth.memberBackend).toBe(false)
  expect(usePreferencesStore.getState().feelingSearchEnabled).toBe(false)
}

describe("mobile auth lifecycle (all providers)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      mode: "guest",
      displayName: "Guest",
      email: null,
      memberId: null,
      isAdmin: false,
      memberBackend: false,
      identityProvider: null,
      sessionEpoch: 0,
      hasCompletedWelcome: true,
    })
    usePreferencesStore.setState({
      feelingSearchEnabled: true,
      favoritesScope: "guest",
      savedSongIds: ["ps-1"],
      favoritesByScope: { guest: ["ps-1"] },
    })
    fetchMemberFavorites.mockResolvedValue([])
    fetchMemberSession.mockResolvedValue(syncedMemberSession())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("sign-in", () => {
    it("signs in with Microsoft and syncs the member session", async () => {
      signInWithMicrosoft.mockResolvedValue({
        id: "oid-ms",
        email: "ms@example.com",
        displayName: "MS Member",
        idToken: "token",
      })
      fetchMemberSession.mockResolvedValue(
        syncedMemberSession({
          display_name: "MS Member",
          email: "ms@example.com",
          identity_provider: "aad",
          favorite_song_numbers: [12],
        }),
      )

      const result = await signInMember()

      expect(result.ok).toBe(true)
      expect(result.memberBackend).toBe(true)
      expect(useAuthStore.getState()).toMatchObject({
        mode: "signed_in",
        email: "ms@example.com",
        memberId: "oid-ms",
        identityProvider: "aad",
        memberBackend: true,
      })
      expect(usePreferencesStore.getState().savedSongIds).toEqual(["ps-12"])
    })

    it("signs in with Google", async () => {
      signInWithGoogle.mockResolvedValue({
        id: "gid-1",
        email: "google@example.com",
        displayName: "Google Member",
        provider: "google",
      })
      fetchMemberSession.mockResolvedValue(
        syncedMemberSession({
          email: "google@example.com",
          identity_provider: "google",
        }),
      )

      await signInWithGoogleAccount()

      expect(useAuthStore.getState()).toMatchObject({
        mode: "signed_in",
        email: "google@example.com",
        memberId: "gid-1",
        identityProvider: "google",
      })
    })

    it("signs in with Facebook", async () => {
      signInWithFacebook.mockResolvedValue({
        id: "fb-1",
        email: "fb@example.com",
        displayName: "FB Member",
        provider: "facebook",
      })
      fetchMemberSession.mockResolvedValue(
        syncedMemberSession({
          email: "fb@example.com",
          identity_provider: "facebook",
        }),
      )

      await signInWithFacebookAccount()

      expect(useAuthStore.getState()).toMatchObject({
        mode: "signed_in",
        email: "fb@example.com",
        memberId: "fb-1",
        identityProvider: "facebook",
      })
    })

    it("signs in with email and password", async () => {
      const principal = buildClientPrincipal("local-oid", "Email Member", "local", "email@example.com")
      loginWithEmail.mockResolvedValue({
        client_principal: principal,
        display_name: "Email Member",
        email: "email@example.com",
        identity_provider: "local",
      })
      fetchMemberSession.mockResolvedValue(
        syncedMemberSession({
          display_name: "Email Member",
          email: "email@example.com",
          identity_provider: "local",
        }),
      )

      await signInWithEmailPassword("email@example.com", "password123")

      expect(loginWithEmail).toHaveBeenCalledWith({
        email: "email@example.com",
        password: "password123",
      })
      expect(useAuthStore.getState()).toMatchObject({
        mode: "signed_in",
        email: "email@example.com",
        memberId: "local-oid",
        identityProvider: "local",
      })
    })

    it("registers with email and lands signed in", async () => {
      const principal = buildClientPrincipal("reg-oid", "New Member", "local", "new@example.com")
      registerWithEmail.mockResolvedValue({
        client_principal: principal,
        display_name: "New Member",
        email: "new@example.com",
        identity_provider: "local",
      })
      fetchMemberSession.mockResolvedValue(
        syncedMemberSession({
          display_name: "New Member",
          email: "new@example.com",
          identity_provider: "local",
          phone_required: true,
        }),
      )

      const result = await signUpWithEmailPassword(
        "new@example.com",
        "password123",
        "New Member",
        "+91",
        "9876543210",
      )

      expect(result.needsPhone).toBe(true)
      expect(useAuthStore.getState().mode).toBe("signed_in")
      expect(useAuthStore.getState().identityProvider).toBe("local")
    })
  })

  describe("sign-out", () => {
    it.each([
      { provider: "aad", email: "ms@example.com", memberId: "oid-ms" },
      { provider: "google", email: "google@example.com", memberId: "gid-1" },
      { provider: "facebook", email: "fb@example.com", memberId: "fb-1" },
      { provider: "local", email: "email@example.com", memberId: "local-oid" },
    ] as const)("clears $provider sessions to guest immediately", async ({ provider, email, memberId }) => {
      useAuthStore.setState({
        mode: "signed_in",
        displayName: "Member",
        email,
        memberId,
        identityProvider: provider,
        memberBackend: true,
        hasCompletedWelcome: true,
        sessionEpoch: 5,
      })
      usePreferencesStore.setState({ feelingSearchEnabled: true })

      await signOutMember()

      assertGuestAfterSignOut()
      expect(useAuthStore.getState().sessionEpoch).toBe(6)
    })

    it("requests Microsoft SSO logout in the background for aad", async () => {
      useAuthStore.setState({
        mode: "signed_in",
        identityProvider: "aad",
        email: "ms@example.com",
        memberId: "oid-ms",
      })

      await signOutMember()
      await Promise.resolve()

      expect(signOutWithMicrosoft).toHaveBeenCalledTimes(1)
      expect(signOutWithGoogle).not.toHaveBeenCalled()
      assertGuestAfterSignOut()
    })

    it("requests Google SDK logout in the background for google", async () => {
      useAuthStore.setState({
        mode: "signed_in",
        identityProvider: "google",
        email: "google@example.com",
        memberId: "gid-1",
      })

      await signOutMember()
      await Promise.resolve()

      expect(signOutWithGoogle).toHaveBeenCalledTimes(1)
      expect(signOutWithMicrosoft).not.toHaveBeenCalled()
      assertGuestAfterSignOut()
    })

    it("does not call Microsoft or Google logout for email/password", async () => {
      useAuthStore.setState({
        mode: "signed_in",
        identityProvider: "local",
        email: "email@example.com",
        memberId: "local-oid",
      })

      await signOutMember()
      await Promise.resolve()

      expect(signOutWithMicrosoft).not.toHaveBeenCalled()
      expect(signOutWithGoogle).not.toHaveBeenCalled()
      assertGuestAfterSignOut()
    })

    it("completeMemberSignOut resets welcome so Profile can open /welcome", async () => {
      useAuthStore.setState({
        mode: "signed_in",
        identityProvider: "local",
        email: "email@example.com",
        memberId: "local-oid",
        hasCompletedWelcome: true,
      })

      await completeMemberSignOut()

      assertGuestAfterSignOut()
      expect(useAuthStore.getState().hasCompletedWelcome).toBe(false)
    })

    it("allows signing back in after completeMemberSignOut", async () => {
      useAuthStore.setState({
        mode: "signed_in",
        identityProvider: "local",
        email: "email@example.com",
        memberId: "local-oid",
        hasCompletedWelcome: true,
      })
      await completeMemberSignOut()

      const principal = buildClientPrincipal("local-oid-2", "Email Member", "local", "email@example.com")
      loginWithEmail.mockResolvedValue({
        client_principal: principal,
        display_name: "Email Member",
        email: "email@example.com",
        identity_provider: "local",
      })
      fetchMemberSession.mockResolvedValue(
        syncedMemberSession({
          email: "email@example.com",
          identity_provider: "local",
        }),
      )

      await signInWithEmailPassword("email@example.com", "password123")

      expect(useAuthStore.getState().mode).toBe("signed_in")
      expect(useAuthStore.getState().memberId).toBe("local-oid-2")
    })
  })

  describe("profile contract", () => {
    it("Profile sign-out uses completeMemberSignOut then welcome route", async () => {
      const fs = await import("node:fs")
      const path = await import("node:path")
      const source = fs.readFileSync(
        path.join(process.cwd(), "app/(tabs)/profile.tsx"),
        "utf8",
      )
      expect(source).toMatch(/completeMemberSignOut/)
      expect(source).toMatch(/router\.replace\(href\("\/welcome"\)\)/)
      expect(source).toMatch(/Signed out/)
    })
  })
})
