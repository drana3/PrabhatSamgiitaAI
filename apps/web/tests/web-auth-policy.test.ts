import { afterEach, describe, expect, it, vi } from "vitest"

import {
  webEasyAuthBackgroundSyncEnabled,
  webGoogleEasyAuthFallbackEnabled,
  webGoogleUsesDirectOAuth,
  webMicrosoftSignInEnabled,
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
    expect(webMicrosoftSignInEnabled()).toBe(false)
  })

  it("enables Microsoft sign-in only when explicitly opted in", () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_MICROSOFT_SIGNIN_ENABLED", "true")
    expect(webMicrosoftSignInEnabled()).toBe(true)
  })

  it("allows SWA Google fallback only in development without a client id", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "")
    expect(webGoogleUsesDirectOAuth()).toBe(false)
    expect(webGoogleEasyAuthFallbackEnabled()).toBe(true)
    expect(webEasyAuthBackgroundSyncEnabled()).toBe(true)
  })
})
