import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

import { buildClientPrincipal } from "@/lib/azure-principal"
import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import { POST } from "@/app/api/ai/explain/route"

describe("AI explain proxy route", () => {
  const originalProxyKey = process.env.MEMBER_PROXY_KEY
  const originalApiBase = process.env.API_BASE_URL

  afterEach(() => {
    if (originalProxyKey === undefined) delete process.env.MEMBER_PROXY_KEY
    else process.env.MEMBER_PROXY_KEY = originalProxyKey
    if (originalApiBase === undefined) delete process.env.API_BASE_URL
    else process.env.API_BASE_URL = originalApiBase
    vi.unstubAllGlobals()
  })

  it("forwards Google cookie auth to the API for member quota", async () => {
    process.env.MEMBER_PROXY_KEY = "proxy-key"
    process.env.API_BASE_URL = "https://api.example.test"
    const principal = buildClientPrincipal("google-user-1", "Member", "google", "member@example.com")
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("data: Grounded answer\n\n", {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const request = new NextRequest("https://example.test/api/ai/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ song_number: 1, prompt: "Explain this song" }),
    })
    request.cookies.set(LOCAL_AUTH_COOKIE, principal)

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.example.test/api/v1/ai/explain")
    expect(fetchMock.mock.calls[0]?.[1]?.headers?.["X-MS-CLIENT-PRINCIPAL"]).toBe(principal)
    expect(fetchMock.mock.calls[0]?.[1]?.headers?.["X-Member-Proxy-Key"]).toBe("proxy-key")
  })
})
