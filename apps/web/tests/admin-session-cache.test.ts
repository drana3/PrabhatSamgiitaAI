import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  clearAdminSessionCache,
  getAdminSessionFlags,
} from "@/lib/admin-session-cache"

describe("admin session cache", () => {
  beforeEach(() => {
    clearAdminSessionCache()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ authenticated: true, is_super_admin: true }),
      }),
    )
  })

  afterEach(() => {
    clearAdminSessionCache()
    vi.unstubAllGlobals()
  })

  it("caches super-admin flag across calls", async () => {
    await expect(getAdminSessionFlags()).resolves.toEqual({ isSuperAdmin: true })
    await expect(getAdminSessionFlags()).resolves.toEqual({ isSuperAdmin: true })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
