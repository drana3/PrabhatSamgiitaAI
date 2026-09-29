import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { signOutMember } from "@/lib/sign-out"

describe("signOutMember", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }))
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "", origin: "https://yellow-desert-06a0d4a00.2.azurestaticapps.net", replace: vi.fn() },
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
    expect(window.location.replace).toHaveBeenCalledWith("/")
  })

  it("uses Easy Auth logout for Microsoft accounts when auth is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_ENABLED", "true")
    await signOutMember("aad")
    expect(window.location.replace).toHaveBeenCalledWith(
      "/.auth/logout?post_logout_redirect_uri=https%3A%2F%2Fyellow-desert-06a0d4a00.2.azurestaticapps.net%2F",
    )
  })

  it("returns home for Google accounts without Easy Auth logout", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_ENABLED", "true")
    await signOutMember("google")
    expect(window.location.replace).toHaveBeenCalledWith("/")
  })
})
