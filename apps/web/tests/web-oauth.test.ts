import { afterEach, describe, expect, it, vi } from "vitest"

import { completeGoogleOAuth, startGoogleOAuth } from "@/lib/web-oauth"

describe("Google PKCE", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("starts Google by asking the server for the authorize URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "google-client")
    const assign = vi.fn()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "",
        origin: "https://example.test",
        protocol: "https:",
        assign,
      },
    })
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=google-client" }),
      }),
    )

    await startGoogleOAuth("/account")
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/google/start",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("https://example.test/auth/callback/google"),
      }),
    )
    expect(assign).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/v2/auth?client_id=google-client")
  })

  it("finishes Google through the server route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, destination: "/account" }),
      }),
    )

    await expect(completeGoogleOAuth("auth-code", "csrf-state")).resolves.toBe("/account")
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/google/finish",
      expect.objectContaining({
        body: expect.stringContaining("auth-code"),
      }),
    )
  })
})
