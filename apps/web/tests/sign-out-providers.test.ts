import { describe, expect, it, vi } from "vitest"

import { usesEasyAuthLogout } from "@/lib/sign-out"

describe("usesEasyAuthLogout", () => {
  it("uses SWA logout for Microsoft", () => {
    expect(usesEasyAuthLogout("aad")).toBe(true)
    expect(usesEasyAuthLogout("azureActiveDirectory")).toBe(true)
  })

  it("uses local logout for direct Google PKCE when client id is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "google-client-id")
    expect(usesEasyAuthLogout("google")).toBe(false)
    vi.unstubAllEnvs()
  })

  it("uses SWA logout for Google when PKCE is not configured", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "")
    expect(usesEasyAuthLogout("google")).toBe(true)
    vi.unstubAllEnvs()
  })
})
