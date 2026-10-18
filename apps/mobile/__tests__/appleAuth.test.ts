import { beforeEach, describe, expect, it, vi } from "vitest"

const { signInAsync, isAvailableAsync } = vi.hoisted(() => ({
  signInAsync: vi.fn(),
  isAvailableAsync: vi.fn(),
}))

const platformState = vi.hoisted(() => ({ os: "ios" as "android" | "ios" }))

vi.mock("expo-apple-authentication", () => ({
  AppleAuthenticationScope: {
    FULL_NAME: 0,
    EMAIL: 1,
  },
  signInAsync,
  isAvailableAsync,
}))

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return platformState.os
    },
  },
}))

vi.mock("@/lib/msal", () => ({
  microsoftAuthConfigured: () => true,
}))

vi.mock("@/lib/googleOAuthConfig", () => ({
  googleAuthConfigured: () => false,
}))

vi.mock("@/lib/facebookAuth", () => ({
  facebookAuthConfigured: () => false,
}))

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
  },
}))

import {
  appleAuthConfigured,
  appleSignInOffered,
  signInWithApple,
} from "@/lib/appleAuth"

describe("appleAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    platformState.os = "ios"
    isAvailableAsync.mockResolvedValue(true)
  })

  it("is configured only on iOS", () => {
    platformState.os = "ios"
    expect(appleAuthConfigured()).toBe(true)
    platformState.os = "android"
    expect(appleAuthConfigured()).toBe(false)
  })

  it("is offered on iOS when another third-party login is configured", () => {
    platformState.os = "ios"
    expect(appleSignInOffered()).toBe(true)
    platformState.os = "android"
    expect(appleSignInOffered()).toBe(false)
  })

  it("returns a member identity from the native Apple sheet", async () => {
    signInAsync.mockResolvedValue({
      user: "apple-sub-1",
      email: "member@privaterelay.appleid.com",
      fullName: { givenName: "Apple", familyName: "Member" },
    })

    await expect(signInWithApple()).resolves.toEqual({
      id: "apple-sub-1",
      email: "member@privaterelay.appleid.com",
      displayName: "Apple Member",
      provider: "apple",
    })
    expect(signInAsync).toHaveBeenCalledWith({
      requestedScopes: [0, 1],
    })
  })

  it("surfaces cancellation without a generic failure message", async () => {
    signInAsync.mockRejectedValue({ code: "ERR_REQUEST_CANCELED" })
    await expect(signInWithApple()).rejects.toThrow("Sign-in was cancelled.")
  })

  it("rejects on non-iOS platforms", async () => {
    platformState.os = "android"
    await expect(signInWithApple()).rejects.toThrow(/only available on iOS/)
  })
})
