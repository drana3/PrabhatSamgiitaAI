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

const { signOutWithMicrosoft } = vi.hoisted(() => ({
  signOutWithMicrosoft: vi.fn(async () => undefined),
}))

vi.mock("@/lib/msal", () => ({
  microsoftAuthConfigured: () => true,
  signInWithMicrosoft: vi.fn(),
  signOutWithMicrosoft,
  getMicrosoftRedirectUri: () => "prabhatai://auth",
}))

vi.mock("@/lib/client", () => ({
  api: {
    fetchMemberSession: vi.fn(),
    fetchMemberFavorites: vi.fn(),
    addMemberFavorite: vi.fn(),
    removeMemberFavorite: vi.fn(),
  },
}))

vi.mock("@/lib/memberAuth", () => ({
  memberAuthAvailable: () => true,
}))

vi.mock("@/lib/googleAuth", () => ({
  googleAuthConfigured: () => false,
  signInWithGoogle: vi.fn(),
  signOutWithGoogle: vi.fn(async () => undefined),
}))

vi.mock("@/lib/facebookAuth", () => ({
  facebookAuthConfigured: () => false,
  signInWithFacebook: vi.fn(),
}))

vi.mock("@/lib/localAuth", () => ({
  loginWithEmail: vi.fn(),
  registerWithEmail: vi.fn(),
}))

import { signOutMember } from "@/lib/session"
import { useAuthStore } from "@/stores/authStore"
import { usePreferencesStore } from "@/stores/preferencesStore"

describe("guest favorites and Microsoft sign-out", () => {
  beforeEach(() => {
    signOutWithMicrosoft.mockClear()
    useAuthStore.setState({
      mode: "guest",
      displayName: "Guest",
      email: null,
      memberId: null,
      isAdmin: false,
      memberBackend: false,
      identityProvider: null,
    })
    usePreferencesStore.setState({
      feelingSearchEnabled: true,
      favoritesScope: "guest",
      savedSongIds: ["ps-1"],
      favoritesByScope: { guest: ["ps-1"] },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("does not save songs while signed out", async () => {
    const result = await usePreferencesStore.getState().toggleSaved("ps-42")
    expect(result).toEqual({ needsAuth: true })
    expect(usePreferencesStore.getState().savedSongIds).toEqual(["ps-1"])
  })

  it("clears feeling search and guest favorites on Microsoft sign-out", async () => {
    useAuthStore.setState({
      mode: "signed_in",
      displayName: "Member",
      email: "member@example.com",
      memberId: "oid-1",
      isAdmin: false,
      memberBackend: true,
      identityProvider: "aad",
    })
    usePreferencesStore.setState({
      feelingSearchEnabled: true,
      favoritesScope: "member:oid-1",
      savedSongIds: ["ps-9"],
      favoritesByScope: { guest: ["ps-1"], "member:oid-1": ["ps-9"] },
    })

    await signOutMember()

    expect(signOutWithMicrosoft).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().mode).toBe("guest")
    expect(usePreferencesStore.getState().feelingSearchEnabled).toBe(false)
    expect(usePreferencesStore.getState().favoritesScope).toBe("guest")
    expect(usePreferencesStore.getState().savedSongIds).toEqual([])
    expect(usePreferencesStore.getState().favoritesByScope.guest).toEqual([])
  })

  it("keeps feeling search off after sign-out even when it was on", async () => {
    useAuthStore.setState({
      mode: "signed_in",
      identityProvider: "google",
      email: "a@b.com",
      memberId: "g-1",
    })
    usePreferencesStore.setState({ feelingSearchEnabled: true })
    await signOutMember()
    expect(signOutWithMicrosoft).not.toHaveBeenCalled()
    expect(usePreferencesStore.getState().feelingSearchEnabled).toBe(false)
  })

  it("clears local session before Microsoft SSO logout so foreground sync cannot revive it", async () => {
    let resolveLogout: (() => void) | undefined
    signOutWithMicrosoft.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveLogout = resolve
        }),
    )
    useAuthStore.setState({
      mode: "signed_in",
      displayName: "Member",
      email: "member@example.com",
      memberId: "oid-1",
      identityProvider: "aad",
      sessionEpoch: 0,
    })

    await signOutMember()
    expect(useAuthStore.getState().mode).toBe("guest")
    expect(useAuthStore.getState().sessionEpoch).toBe(1)
    // Provider logout is fire-and-forget — flush the queued microtask.
    await Promise.resolve()
    expect(signOutWithMicrosoft).toHaveBeenCalledTimes(1)

    resolveLogout?.()
    expect(useAuthStore.getState().mode).toBe("guest")
  })

  it("clears email/password sessions immediately without waiting on SSO", async () => {
    useAuthStore.setState({
      mode: "signed_in",
      displayName: "Member",
      email: "member@example.com",
      memberId: "local-1",
      identityProvider: "local",
      sessionEpoch: 3,
    })
    await signOutMember()
    expect(signOutWithMicrosoft).not.toHaveBeenCalled()
    expect(useAuthStore.getState().mode).toBe("guest")
    expect(useAuthStore.getState().sessionEpoch).toBe(4)
  })
})
