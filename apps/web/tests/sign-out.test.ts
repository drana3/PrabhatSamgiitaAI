import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { signOutMember } from "@/lib/sign-out"

describe("signOutMember", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }))
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
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
    expect(window.location.href).toBe("/")
  })

  it("uses Easy Auth logout for Microsoft accounts when auth is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_ENABLED", "true")
    await signOutMember("aad")
    expect(window.location.href).toBe("/.auth/logout?post_logout_redirect_uri=%2F")
  })
})
