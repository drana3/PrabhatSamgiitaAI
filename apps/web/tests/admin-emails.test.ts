import { afterEach, describe, expect, it } from "vitest"

import { defaultAdminEmails, isDefaultAdminEmail } from "@/lib/admin-emails"

describe("admin emails", () => {
  afterEach(() => {
    delete process.env.DEFAULT_ADMIN_EMAILS
  })

  it("matches configured default admin emails case-insensitively", () => {
    process.env.DEFAULT_ADMIN_EMAILS = "Owner@Example.com, admin@test.org"
    expect(defaultAdminEmails()).toEqual(new Set(["owner@example.com", "admin@test.org"]))
    expect(isDefaultAdminEmail("OWNER@example.com")).toBe(true)
    expect(isDefaultAdminEmail("other@test.org")).toBe(false)
  })
})
