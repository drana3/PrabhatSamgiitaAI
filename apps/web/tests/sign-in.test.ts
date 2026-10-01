import { describe, expect, it } from "vitest"

import { microsoftSignInHref, safeSignInNextPath, signInHref, signInReturnPath } from "@/lib/sign-in"

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
  it("builds the Azure login URL that returns to the Microsoft session callback", () => {
    expect(microsoftSignInHref()).toBe(
      "/.auth/login/aad?post_login_redirect_uri=%2Fauth%2Fcallback%2Fmicrosoft",
    )
    expect(microsoftSignInHref("https://example.test")).toBe(
      "/.auth/login/aad?post_login_redirect_uri=https%3A%2F%2Fexample.test%2Fauth%2Fcallback%2Fmicrosoft",
    )
  })

  it("builds sign-in links that return to the current page", () => {
    expect(signInHref("/quiz")).toBe("/signin?next=%2Fquiz")
    expect(signInHref("/songs/3")).toBe("/signin?next=%2Fsongs%2F3")
    expect(signInHref()).toBe("/signin")
  })

  it("strips hash fragments so Save song cannot bounce through /signin and reload", () => {
    expect(safeSignInNextPath("/songs/135#ask")).toBe("/songs/135")
    expect(signInHref("/songs/135#ask")).toBe("/signin?next=%2Fsongs%2F135")
    expect(microsoftSignInHref()).toBe(
      "/.auth/login/aad?post_login_redirect_uri=%2Fauth%2Fcallback%2Fmicrosoft",
    )
  })

  it("returns song pages without auto-opening the AI companion after sign-in", () => {
    expect(signInReturnPath("/songs/135")).toBe("/songs/135?from=signin")
    expect(signInReturnPath("/account")).toBe("/account")
    expect(signInReturnPath(undefined)).toBe("/")
  })
})
