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

  it("accepts browser-provided /.auth/me payload with SWA auth cookie and matching id header", async () => {
    process.env.NODE_ENV = "production"
    const request = new NextRequest("https://example.test/api/auth/easy-auth-sync", {
      method: "POST",
      headers: {
        cookie: "StaticWebAppsAuthCookie=fake-session",
        "x-ms-client-principal-id": "oid-99",
      },
      body: JSON.stringify({
        clientPrincipal: {
          identityProvider: "aad",
          userId: "oid-99",
          userDetails: "member@example.com",
          userRoles: ["anonymous", "authenticated"],
        },
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(response.cookies.get(LOCAL_AUTH_COOKIE)?.value).toBeTruthy()
  })

  it("accepts browser /.auth/me payload when SWA id header differs from userId (Microsoft)", async () => {
    process.env.NODE_ENV = "production"
    const request = new NextRequest("https://example.test/api/auth/easy-auth-sync", {
      method: "POST",
      headers: {
        cookie: "StaticWebAppsAuthCookie=fake-session",
        "x-ms-client-principal-id": "other-user",
      },
      body: JSON.stringify({
        clientPrincipal: {
          identityProvider: "aad",
          userId: "oid-99",
          userDetails: "member@example.com",
          userRoles: ["anonymous", "authenticated"],
        },
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(response.cookies.get(LOCAL_AUTH_COOKIE)?.value).toBeTruthy()
  })
})
