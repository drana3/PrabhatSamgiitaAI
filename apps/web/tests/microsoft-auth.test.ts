import { afterEach, describe, expect, it, vi } from "vitest"

import { completeMicrosoftEasyAuth, startMicrosoftEasyAuth } from "@/lib/microsoft-auth"

describe("microsoft easy auth", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it("stores the return path and starts SWA Microsoft login", () => {
    const assign = vi.fn()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign, origin: "https://example.test" },
    })

    startMicrosoftEasyAuth("/account")
    expect(sessionStorage.getItem("ps_oauth_microsoft_next")).toBe("/account")
    expect(assign).toHaveBeenCalledWith(
      "/.auth/login/aad?post_login_redirect_uri=https%3A%2F%2Fexample.test%2Fauth%2Fcallback%2Fmicrosoft",
    )
  })

  it("mints a member cookie from /.auth/me then returns home", async () => {
    sessionStorage.setItem("ps_oauth_microsoft_next", "/")
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          clientPrincipal: {
            identityProvider: "aad",
            userId: "oid-ms",
            userDetails: "member@example.com",
            userRoles: ["anonymous", "authenticated"],
          },
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal("fetch", fetchMock)

    await expect(completeMicrosoftEasyAuth()).resolves.toBe("/")
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/.auth/me", expect.objectContaining({ credentials: "same-origin" }))
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/auth/principal",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"identity_provider\":\"aad\""),
      }),
    )
  })
})
