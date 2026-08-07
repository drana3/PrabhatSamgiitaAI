import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

import { buildClientPrincipal } from "@/lib/azure-principal"
import {
  fetchBackendMemberSession,
  isAdminDestination,
  memberPrincipalFor,
} from "@/lib/member-request"
import { memberSessionIsAdmin } from "@/lib/member-admin-proxy"

describe("member request helpers", () => {
  const originalProxyKey = process.env.MEMBER_PROXY_KEY
  const originalApiBase = process.env.API_BASE_URL

  afterEach(() => {
    if (originalProxyKey === undefined) delete process.env.MEMBER_PROXY_KEY
    else process.env.MEMBER_PROXY_KEY = originalProxyKey
    if (originalApiBase === undefined) delete process.env.API_BASE_URL
    else process.env.API_BASE_URL = originalApiBase
    vi.unstubAllGlobals()
  })

  it("detects admin destinations", () => {
    expect(isAdminDestination("/admin")).toBe(true)
    expect(isAdminDestination("/admin/quiz")).toBe(true)
    expect(isAdminDestination("/account")).toBe(false)
  })

  it("reads principals from Azure headers", () => {
    const principal = buildClientPrincipal("user-oid-42", "owner@example.com")
    const request = new NextRequest("https://example.test/admin/feedback", {
      headers: { "x-ms-client-principal": principal },
    })
    expect(memberPrincipalFor(request)).toBe(principal)
  })

  it("loads admin status from the member API directly", async () => {
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
    expect(fetchMock.mock.calls[0]?.[1]?.headers?.["X-Member-Proxy-Key"]).toBe("proxy-key")
  })

  it("returns null when the member proxy key is missing", async () => {
    delete process.env.MEMBER_PROXY_KEY
    const principal = buildClientPrincipal("user-oid-42", "owner@example.com")
    await expect(fetchBackendMemberSession(principal)).resolves.toBeNull()
  })
})
