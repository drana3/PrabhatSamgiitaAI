import { afterEach, describe, expect, it, vi } from "vitest"

import {
  webEasyAuthBackgroundSyncEnabled,
  webGoogleEasyAuthFallbackEnabled,
  webGoogleUsesDirectOAuth,
} from "@/lib/web-auth-policy"

describe("web auth policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("requires direct Google OAuth in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "google-client")
    expect(webGoogleUsesDirectOAuth()).toBe(true)
    expect(webGoogleEasyAuthFallbackEnabled()).toBe(false)
    expect(webEasyAuthBackgroundSyncEnabled()).toBe(false)
  })

  it("allows SWA Google fallback only in development without a client id", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "")
    expect(webGoogleUsesDirectOAuth()).toBe(false)
    expect(webGoogleEasyAuthFallbackEnabled()).toBe(true)
    expect(webEasyAuthBackgroundSyncEnabled()).toBe(true)
  })
})
