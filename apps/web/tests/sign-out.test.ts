import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { signOutMember } from "@/lib/sign-out"

describe("signOutMember", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }))
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        href: "",
        origin: "https://yellow-desert-06a0d4a00.2.azurestaticapps.net",
        replace: vi.fn(),
        assign: vi.fn(),
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("returns home for local accounts without Easy Auth logout", async () => {
    await signOutMember("local")
    expect(fetch).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    })
    expect(window.location.assign).toHaveBeenCalledWith("/")
  })

  it("uses Easy Auth logout for Microsoft accounts when auth is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_ENABLED", "true")
    await signOutMember("aad")
    expect(window.location.assign).toHaveBeenCalledWith("/api/auth/sign-out")
  })

  it("returns home for Google PKCE accounts without SWA logout", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_ENABLED", "true")
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "google-client-id")
    await signOutMember("google")
    expect(window.location.assign).toHaveBeenCalledWith("/")
  })
})
