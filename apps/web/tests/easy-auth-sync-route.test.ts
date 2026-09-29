import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

import { POST } from "@/app/api/auth/easy-auth-sync/route"
import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"

describe("easy-auth-sync route", () => {
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    vi.unstubAllGlobals()
  })

  it("does not mint a member cookie for anonymous guests (keeps 15/day AI quota)", async () => {
    process.env.NODE_ENV = "production"
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ clientPrincipal: null }),
      }),
    )

    const request = new NextRequest("https://example.test/api/auth/easy-auth-sync", {
      method: "POST",
      headers: {
        "x-ms-client-principal-id": "guest-spoof-id",
        "x-ms-client-principal-name": "guest@example.com",
      },
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
    expect(response.cookies.get(LOCAL_AUTH_COOKIE)?.value).toBeUndefined()
  })

  it("mints a member cookie only when SWA reports an authenticated principal", async () => {
    process.env.NODE_ENV = "production"
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          clientPrincipal: {
            identityProvider: "aad",
            userId: "oid-99",
            userDetails: "member@example.com",
            userRoles: ["anonymous", "authenticated"],
          },
        }),
      }),
    )

    const request = new NextRequest("https://example.test/api/auth/easy-auth-sync", {
      method: "POST",
      headers: {
        cookie: "StaticWebAppsAuthCookie=fake-session",
      },
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(response.cookies.get(LOCAL_AUTH_COOKIE)?.value).toBeTruthy()
  })
})
