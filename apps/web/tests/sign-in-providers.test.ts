import { describe, expect, it } from "vitest"

import {
  facebookSignInHref,
  googleSignInHref,
  microsoftSignInHref,
} from "@/lib/sign-in"

describe("multi-provider sign-in links", () => {
  it("builds Microsoft Easy Auth links", () => {
    expect(microsoftSignInHref("/saved")).toContain("/.auth/login/aad")
    expect(microsoftSignInHref("/saved")).toContain("post_login_redirect_uri=")
  })

  it("builds Google Easy Auth links", () => {
    expect(googleSignInHref("/quiz")).toContain("/.auth/login/google")
  })

  it("builds Facebook Easy Auth links", () => {
    expect(facebookSignInHref("/account")).toContain("/.auth/login/facebook")
  })
})
