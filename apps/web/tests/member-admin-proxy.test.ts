import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

import { buildClientPrincipal } from "@/lib/azure-principal"
import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import { forwardMemberAdmin, memberSessionIsAdmin } from "@/lib/member-admin-proxy"

describe("member admin session", () => {
  const originalProxyKey = process.env.MEMBER_PROXY_KEY
  const originalApiBase = process.env.API_BASE_URL

  afterEach(() => {
    if (originalProxyKey === undefined) delete process.env.MEMBER_PROXY_KEY
    else process.env.MEMBER_PROXY_KEY = originalProxyKey
    if (originalApiBase === undefined) delete process.env.API_BASE_URL
    else process.env.API_BASE_URL = originalApiBase
    vi.unstubAllGlobals()
  })

  it("returns true for authenticated admins", async () => {
    process.env.MEMBER_PROXY_KEY = "proxy-key"
    process.env.API_BASE_URL = "https://api.example.test"
    const principal = buildClientPrincipal("user-oid-42", "owner@example.com")
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: true, is_admin: true }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const request = new NextRequest("https://example.test/admin/feedback", {
      headers: { "x-ms-client-principal": principal },
    })
    await expect(memberSessionIsAdmin(request)).resolves.toBe(true)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.example.test/api/v1/members/session")
  })

  it("skips the backend session fetch when the admin gate cookie is valid", async () => {
    process.env.MEMBER_PROXY_KEY = "proxy-key"
    process.env.API_BASE_URL = "https://api.example.test"
    const principal = buildClientPrincipal("user-oid-42", "owner@example.com")
    const { buildAdminGateToken } = await import("@/lib/admin-gate")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const request = new NextRequest("https://example.test/admin/youtube", {
      headers: { "x-ms-client-principal": principal },
    })
    request.cookies.set("psa_admin_gate", await buildAdminGateToken(principal))

    await expect(memberSessionIsAdmin(request)).resolves.toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("falls back to the backend session when the gate cookie is invalid", async () => {
    process.env.MEMBER_PROXY_KEY = "proxy-key"
    process.env.API_BASE_URL = "https://api.example.test"
    const principal = buildClientPrincipal("user-oid-42", "owner@example.com")
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: true, is_admin: true }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const request = new NextRequest("https://example.test/admin/feedback", {
      headers: { "x-ms-client-principal": principal },
    })
    request.cookies.set("psa_admin_gate", "invalid-token")

    await expect(memberSessionIsAdmin(request)).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("returns false when session says member is not admin", async () => {
    process.env.MEMBER_PROXY_KEY = "proxy-key"
    process.env.API_BASE_URL = "https://api.example.test"
    const principal = buildClientPrincipal("user-oid-42", "owner@example.com")
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: true, is_admin: false, email: "owner@example.com" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const request = new NextRequest("https://example.test/admin/feedback", {
      headers: { "x-ms-client-principal": principal },
    })
    await expect(memberSessionIsAdmin(request)).resolves.toBe(false)
  })

  it("returns false when session is unavailable", async () => {
    process.env.MEMBER_PROXY_KEY = "proxy-key"
    process.env.API_BASE_URL = "https://api.example.test"
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))

    const principal = buildClientPrincipal("user-oid-42", "owner@example.com")
    const request = new NextRequest("https://example.test/admin/feedback", {
      headers: { "x-ms-client-principal": principal },
    })

    await expect(memberSessionIsAdmin(request)).resolves.toBe(false)
  })

  it("returns false for signed-in non-admin members", async () => {
    process.env.MEMBER_PROXY_KEY = "proxy-key"
    process.env.API_BASE_URL = "https://api.example.test"
    const principal = buildClientPrincipal("user-oid-42", "member@example.com")
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: true, is_admin: false, email: "member@example.com" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const request = new NextRequest("https://example.test/admin/feedback", {
      headers: { "x-ms-client-principal": principal },
    })
    await expect(memberSessionIsAdmin(request)).resolves.toBe(false)
  })

  it("loads admin feedback through the member admin API", async () => {
    process.env.MEMBER_PROXY_KEY = "proxy-key"
    const principal = buildClientPrincipal("user-oid-42", "owner@example.com")
    const headers = new Headers({
      "x-ms-client-principal": principal,
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 1,
        items: [{
          feedback_id: "fb-1",
          category: "search",
          rating: 4,
          comment: "Search felt fast",
          page_path: "/explore",
          contact: "owner@example.com",
          status: "new",
          created_at: "2026-08-02T12:00:00+00:00",
          priority: false,
        }],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const { fetchAdminFeedback } = await import("@/lib/member-admin-proxy")
    await expect(fetchAdminFeedback(headers, "new")).resolves.toMatchObject({
      total: 1,
      items: [expect.objectContaining({ comment: "Search felt fast" })],
    })
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/members/admin/feedback?status=new")
  })

  it("reports missing member proxy configuration clearly", async () => {
    delete process.env.MEMBER_PROXY_KEY
    const principal = buildClientPrincipal("user-oid-42", "owner@example.com")
    const headers = new Headers({ "x-ms-client-principal": principal })
    const { fetchAdminFeedback } = await import("@/lib/member-admin-proxy")
    await expect(fetchAdminFeedback(headers, "new")).resolves.toMatchObject({
      total: 0,
      items: [],
      error: "Member services are not configured",
    })
  })

  it("forwards admin requests using the local auth cookie", async () => {
    process.env.MEMBER_PROXY_KEY = "proxy-key"
    process.env.API_BASE_URL = "https://api.example.test"
    const principal = buildClientPrincipal("google-user-1", "owner@example.com", "google")
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ total: 0, items: [] }),
      headers: { get: () => "application/json" },
    })
    vi.stubGlobal("fetch", fetchMock)

    const request = new NextRequest("https://example.test/api/admin/feedback?status=new")
    request.cookies.set(LOCAL_AUTH_COOKIE, principal)

    const response = await forwardMemberAdmin(request, "feedback")
    expect(response.status).toBe(200)
    const [targetUrl, init] = fetchMock.mock.calls[0] ?? []
    expect(String(targetUrl)).toContain("/api/v1/members/admin/feedback")
    expect((init as RequestInit).headers).toMatchObject({
      "X-MS-CLIENT-PRINCIPAL": principal,
    })
  })
})
