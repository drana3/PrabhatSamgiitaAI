import { describe, expect, it } from "vitest"

import { microsoftSignInHref, safeSignInNextPath, signInHref } from "@/lib/sign-in"

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
  it("builds the Azure login URL with a post-login return through sign-in", () => {
    expect(microsoftSignInHref("/account")).toBe(
      "/.auth/login/aad?post_login_redirect_uri=%2Fsignin%3Fnext%3D%252Faccount",
    )
    expect(microsoftSignInHref(undefined)).toBe(
      "/.auth/login/aad?post_login_redirect_uri=%2Fsignin%3Fnext%3D%252F",
    )
  })

  it("builds sign-in links that return to the current page", () => {
    expect(signInHref("/quiz")).toBe("/signin?next=%2Fquiz")
    expect(signInHref("/songs/3")).toBe("/signin?next=%2Fsongs%2F3")
    expect(signInHref()).toBe("/signin")
  })
})
