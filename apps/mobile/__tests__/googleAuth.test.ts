import { beforeEach, describe, expect, it, vi } from "vitest"

const { signIn, configure, hasPlayServices } = vi.hoisted(() => ({
  signIn: vi.fn(),
  configure: vi.fn(),
  hasPlayServices: vi.fn(),
}))

vi.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure,
    signIn,
    hasPlayServices,
  },
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
    IN_PROGRESS: "IN_PROGRESS",
    PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
  },
}))

const platformState = vi.hoisted(() => ({ os: "android" as "android" | "ios" }))

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return platformState.os
    },
  },
}))

vi.mock("@/lib/googleOAuthConfig", () => ({
  googleAuthConfigured: () => true,
  googleWebClientId: () => "495992354696-e0gs1mfnndgh9d38nkmp211f43im1h9q.apps.googleusercontent.com",
  googleIosClientId: () => "495992354696-l5ddf29pefc5ke9f1t8osi9dch0qckrs.apps.googleusercontent.com",
  googleAndroidClientId: () =>
    "495992354696-bg5emq0rv8hv4bqgk8uanvi2vkj34alv.apps.googleusercontent.com",
  googleSetupHint: () => "configure google",
}))

import { signInWithGoogle } from "@/lib/googleAuth"

describe("signInWithGoogle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    platformState.os = "android"
    hasPlayServices.mockResolvedValue(true)
  })

  it("returns a member identity from the native Google account picker on Android", async () => {
    signIn.mockResolvedValue({
      type: "success",
      data: {
        user: {
          id: "google-sub-1",
          email: "member@example.com",
          name: "Google Member",
        },
      },
    })

    await expect(signInWithGoogle()).resolves.toEqual({
      id: "google-sub-1",
      email: "member@example.com",
      displayName: "Google Member",
      provider: "google",
    })
    expect(hasPlayServices).toHaveBeenCalled()
    expect(configure).toHaveBeenCalledWith(
      expect.objectContaining({
        webClientId: "495992354696-e0gs1mfnndgh9d38nkmp211f43im1h9q.apps.googleusercontent.com",
      }),
    )
  })

  it("configures the iOS client id on iPhone builds", async () => {
    vi.resetModules()
    platformState.os = "ios"
    signIn.mockResolvedValue({
      type: "success",
      data: {
        user: {
          id: "google-sub-ios",
          email: "ios@example.com",
          name: "iOS Member",
        },
      },
    })

    const { signInWithGoogle: signInOnIos } = await import("@/lib/googleAuth")
    await signInOnIos()

    expect(hasPlayServices).not.toHaveBeenCalled()
    expect(configure).toHaveBeenCalledWith(
      expect.objectContaining({
        webClientId: "495992354696-e0gs1mfnndgh9d38nkmp211f43im1h9q.apps.googleusercontent.com",
        iosClientId: "495992354696-l5ddf29pefc5ke9f1t8osi9dch0qckrs.apps.googleusercontent.com",
      }),
    )
  })
})
