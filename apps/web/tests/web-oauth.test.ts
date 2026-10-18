import { afterEach, describe, expect, it, vi } from "vitest"

import { completeGoogleOAuth, startGoogleOAuth } from "@/lib/web-oauth"

describe("Google PKCE", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("starts Google via navigation so the PKCE cookie is set on redirect", () => {
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

    startGoogleOAuth("/account")
    expect(assign).toHaveBeenCalledWith("/api/auth/google/begin?next=%2Faccount")
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
