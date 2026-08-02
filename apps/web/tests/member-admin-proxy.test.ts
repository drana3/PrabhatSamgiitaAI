import { describe, expect, it, vi } from "vitest"

import { memberSessionIsAdmin } from "@/lib/member-admin-proxy"

describe("member admin session", () => {
  it("returns true only for authenticated admins", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: true, is_admin: true }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const request = { url: "https://example.test/admin/feedback", headers: { get: () => null } } as never
    await expect(memberSessionIsAdmin(request)).resolves.toBe(true)

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authenticated: true, is_admin: false }),
    })
    await expect(memberSessionIsAdmin(request)).resolves.toBe(false)

    vi.unstubAllGlobals()
  })
})
