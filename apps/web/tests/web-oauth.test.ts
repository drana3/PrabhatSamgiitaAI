import { afterEach, describe, expect, it, vi } from "vitest"

import { completeGoogleOAuth, startGoogleOAuth } from "@/lib/web-oauth"

describe("Google PKCE", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    sessionStorage.clear()
    localStorage.clear()
    document.cookie.split("; ").forEach((part) => {
      const name = part.split("=")[0]
      if (name) document.cookie = `${name}=; path=/; max-age=0`
    })
  })

  it("stores the PKCE verifier in a cookie so the Google bounce can finish", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "google-client")
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "",
        origin: "https://example.test",
        protocol: "https:",
      },
    })

    await startGoogleOAuth("/account")
    expect(sessionStorage.getItem("ps_oauth_google_verifier")).toBeTruthy()
    expect(localStorage.getItem("ps_oauth_google_verifier")).toBeTruthy()
    expect(window.location.href).toContain("accounts.google.com")
    expect(window.location.href).toContain(encodeURIComponent("https://example.test/auth/callback/google"))
  })

  it("reads the verifier from a cookie when sessionStorage is empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "google-client")
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        origin: "https://example.test",
        protocol: "https:",
      },
    })
    document.cookie = "ps_oauth_google_verifier=cookie-verifier; path=/"
    document.cookie = "ps_oauth_google_next=%2Faccount; path=/"
    sessionStorage.clear()
    localStorage.clear()

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "ya29.token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sub: "gid-1", email: "member@example.com", name: "Member" }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal("fetch", fetchMock)

    await expect(completeGoogleOAuth("auth-code")).resolves.toBe("/account")
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/auth/google/token",
      expect.objectContaining({
        body: expect.stringContaining("cookie-verifier"),
      }),
    )
  })
})
