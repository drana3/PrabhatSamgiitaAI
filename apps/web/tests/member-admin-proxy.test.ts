import { afterEach, describe, expect, it, vi } from "vitest"

import { buildClientPrincipal } from "@/lib/azure-principal"
import { memberSessionIsAdmin } from "@/lib/member-admin-proxy"

describe("member admin session", () => {
  afterEach(() => {
    delete process.env.DEFAULT_ADMIN_EMAILS
    vi.unstubAllGlobals()
  })

  it("returns true for authenticated admins", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: true, is_admin: true }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const request = { url: "https://example.test/admin/feedback", headers: { get: () => null } } as never
    await expect(memberSessionIsAdmin(request)).resolves.toBe(true)
  })

  it("promotes configured default admin emails from session responses", async () => {
    process.env.DEFAULT_ADMIN_EMAILS = "owner@example.com"
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: true, is_admin: false, email: "owner@example.com" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const request = { url: "https://example.test/admin/feedback", headers: { get: () => null } } as never
    await expect(memberSessionIsAdmin(request)).resolves.toBe(true)
  })

  it("falls back to Azure principal email when session is unavailable", async () => {
    process.env.DEFAULT_ADMIN_EMAILS = "owner@example.com"
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))

    const principal = buildClientPrincipal("user-oid-42", "owner@example.com")
    const headers = new Headers({ "x-ms-client-principal": principal })
    const request = {
      url: "https://example.test/admin/feedback",
      headers: { get: (name: string) => headers.get(name) },
    } as never

    await expect(memberSessionIsAdmin(request)).resolves.toBe(true)
  })

  it("returns false for signed-in non-admin members", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: true, is_admin: false, email: "member@example.com" }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const request = { url: "https://example.test/admin/feedback", headers: { get: () => null } } as never
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
})
