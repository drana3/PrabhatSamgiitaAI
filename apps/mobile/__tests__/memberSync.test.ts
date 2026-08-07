import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { fetchMemberSession } = vi.hoisted(() => ({
  fetchMemberSession: vi.fn(),
}))

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

vi.mock("@/lib/client", () => ({
  api: {
    fetchMemberSession,
  },
}))

vi.mock("@/lib/memberAuth", () => ({
  memberAuthAvailable: () => true,
}))

vi.mock("@/lib/msal", () => ({
  microsoftAuthConfigured: () => false,
  signInWithMicrosoft: vi.fn(),
  getMicrosoftRedirectUri: () => "prabhat://auth",
}))

vi.mock("@/lib/googleAuth", () => ({
  googleAuthConfigured: () => false,
  signInWithGoogle: vi.fn(),
}))

vi.mock("@/lib/facebookAuth", () => ({
  facebookAuthConfigured: () => false,
  signInWithFacebook: vi.fn(),
}))

vi.mock("@/lib/localAuth", () => ({
  loginWithEmail: vi.fn(),
  registerWithEmail: vi.fn(),
}))

import { refreshMemberSession } from "@/lib/session"
import { useAuthStore } from "@/stores/authStore"
import { usePreferencesStore } from "@/stores/preferencesStore"

describe("member sync from database", () => {
  beforeEach(() => {
    useAuthStore.setState({
      mode: "signed_in",
      displayName: "Member",
      email: "member@example.com",
      memberId: "oid-123",
      isAdmin: false,
      memberBackend: true,
      identityProvider: "aad",
    })
    usePreferencesStore.setState({ savedSongIds: [] })
    fetchMemberSession.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("restores admin and favorites from the member session API (simulates new device login)", async () => {
    fetchMemberSession.mockResolvedValue({
      authenticated: true,
      id: "11111111-1111-1111-1111-111111111111",
      display_name: "Member",
      email: "member@example.com",
      identity_provider: "aad",
      personalization_enabled: true,
      is_admin: true,
      favorite_song_numbers: [12, 99],
    })

    const result = await refreshMemberSession()

    expect(result.ok).toBe(true)
    expect(useAuthStore.getState().isAdmin).toBe(true)
    expect(usePreferencesStore.getState().savedSongIds).toEqual(["ps-12", "ps-99"])
    expect(useAuthStore.getState().memberId).toBe("oid-123")
  })

  it("clears elevated admin when database revokes access", async () => {
    useAuthStore.setState({ isAdmin: true })
    fetchMemberSession.mockResolvedValue({
      authenticated: true,
      id: "11111111-1111-1111-1111-111111111111",
      display_name: "Member",
      email: "member@example.com",
      identity_provider: "aad",
      personalization_enabled: true,
      is_admin: false,
      favorite_song_numbers: [],
    })

    await refreshMemberSession()

    expect(useAuthStore.getState().isAdmin).toBe(false)
  })
})
