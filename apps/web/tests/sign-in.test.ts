import { describe, expect, it } from "vitest"

import { microsoftSignInHref, safeSignInNextPath } from "@/lib/sign-in"

describe("safeSignInNextPath", () => {
  it("defaults to home for missing or unsafe paths", () => {
    expect(safeSignInNextPath(undefined)).toBe("/")
    expect(safeSignInNextPath("")).toBe("/")
    expect(safeSignInNextPath("//evil.test")).toBe("/")
    expect(safeSignInNextPath("https://evil.test")).toBe("/")
  })

  it("keeps safe in-app paths", () => {
    expect(safeSignInNextPath("/account")).toBe("/account")
    expect(safeSignInNextPath("/admin/feedback")).toBe("/admin/feedback")
  })
})

describe("microsoftSignInHref", () => {
  it("builds the Azure login URL with the post-login destination", () => {
    expect(microsoftSignInHref("/account")).toBe("/.auth/login/aad?post_login_redirect_uri=%2Faccount")
    expect(microsoftSignInHref(undefined)).toBe("/.auth/login/aad?post_login_redirect_uri=%2F")
  })
})
