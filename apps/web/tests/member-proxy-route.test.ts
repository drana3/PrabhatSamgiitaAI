import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

import { buildClientPrincipal } from "@/lib/azure-principal"
import { GET, POST } from "@/app/api/member/[...path]/route"

describe("member proxy route", () => {
  const originalProxyKey = process.env.MEMBER_PROXY_KEY
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    if (originalProxyKey === undefined) delete process.env.MEMBER_PROXY_KEY
    else process.env.MEMBER_PROXY_KEY = originalProxyKey
    process.env.NODE_ENV = originalNodeEnv
    vi.unstubAllGlobals()
  })

  it("does not fake an authenticated session when MEMBER_PROXY_KEY is missing", async () => {
    delete process.env.MEMBER_PROXY_KEY
    process.env.NODE_ENV = "production"
    const principal = buildClientPrincipal("user-oid-42", "member@example.com")
    const request = new NextRequest("https://example.test/api/member/session", {
      headers: { "x-ms-client-principal": principal },
    })

    const response = await GET(request, { params: Promise.resolve({ path: ["session"] }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ authenticated: false })
  })

  it("returns 503 for favorite writes when MEMBER_PROXY_KEY is missing", async () => {
    delete process.env.MEMBER_PROXY_KEY
    process.env.NODE_ENV = "production"
    const principal = buildClientPrincipal("user-oid-42", "member@example.com")
    const request = new NextRequest("https://example.test/api/member/favorites", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ms-client-principal": principal,
      },
      body: JSON.stringify({ song_number: 1 }),
    })

    const response = await POST(request, { params: Promise.resolve({ path: ["favorites"] }) })
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.detail).toMatch(/not configured/i)
  })

  it("forwards API session failures instead of synthesizing a signed-in profile", async () => {
    process.env.MEMBER_PROXY_KEY = "proxy-key"
    process.env.NODE_ENV = "production"
    const principal = buildClientPrincipal("user-oid-42", "member@example.com")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: "Member API unavailable" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    )))

    const request = new NextRequest("https://example.test/api/member/session", {
      headers: { "x-ms-client-principal": principal },
    })
    const response = await GET(request, { params: Promise.resolve({ path: ["session"] }) })
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.detail).toBe("Member API unavailable")
    expect(body.authenticated).toBeUndefined()
  })
})
