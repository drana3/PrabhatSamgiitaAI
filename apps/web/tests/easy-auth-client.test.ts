import { describe, expect, it, vi } from "vitest"

import { fetchBrowserEasyAuthPrincipal, easyAuthSyncBlockedOnPage, syncEasyAuthSessionFromBrowser } from "@/lib/easy-auth-client"
import { EXPLICIT_SIGN_OUT_KEY } from "@/lib/explicit-sign-out"

describe("easy-auth-client", () => {
  it("reads /.auth/me in the browser and posts the principal to easy-auth-sync", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            clientPrincipal: {
              identityProvider: "aad",
              userId: "oid-1",
              userDetails: "member@example.com",
              userRoles: ["authenticated"],
            },
          },
        ],
      })
      .mockResolvedValueOnce({ ok: true })

    vi.stubGlobal("fetch", fetchMock)

    await expect(syncEasyAuthSessionFromBrowser()).resolves.toBe(true)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/.auth/me",
      expect.objectContaining({ credentials: "same-origin" }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/auth/easy-auth-sync",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("oid-1"),
      }),
    )

    vi.unstubAllGlobals()
  })

  it("does not overwrite an existing member session with SWA /.auth/me", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: true }),
      })
    vi.stubGlobal("fetch", fetchMock)

    await expect(syncEasyAuthSessionFromBrowser()).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/api/member/session", expect.any(Object))

    vi.unstubAllGlobals()
  })

  it("falls back to /api/auth/principal when easy-auth-sync rejects the SWA cookie", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          clientPrincipal: {
            identityProvider: "aad",
            userId: "oid-2",
            userDetails: "member@example.com",
            userRoles: ["authenticated"],
          },
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })

    vi.stubGlobal("fetch", fetchMock)

    await expect(syncEasyAuthSessionFromBrowser()).resolves.toBe(true)
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/auth/principal", expect.objectContaining({ method: "POST" }))

    vi.unstubAllGlobals()
  })

  it("returns null when /.auth/me has no principal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ clientPrincipal: null }),
      }),
    )

    await expect(fetchBrowserEasyAuthPrincipal()).resolves.toBeNull()
    vi.unstubAllGlobals()
  })

  it("blocks Easy Auth auto-sync after an explicit sign-out", () => {
    localStorage.setItem(EXPLICIT_SIGN_OUT_KEY, "1")
    expect(easyAuthSyncBlockedOnPage()).toBe(true)
    localStorage.removeItem(EXPLICIT_SIGN_OUT_KEY)
  })
})
