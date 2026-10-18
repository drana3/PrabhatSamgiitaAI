import { afterEach, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"

import {
  apexToWwwRedirectUrl,
  isAllowedWebOAuthRedirect,
  publicRedirectUrl,
  requestIsSecure,
  resolvePublicSiteOrigin,
} from "@/lib/site-origin"

describe("resolvePublicSiteOrigin", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it("never uses SWA's internal localhost:8080 when a public host is forwarded", () => {
    const request = new NextRequest("http://localhost:8080/api/auth/microsoft/complete", {
      headers: {
        "x-forwarded-host": "www.prabhatasamgiita.org",
        "x-forwarded-proto": "https",
      },
    })
    expect(resolvePublicSiteOrigin(request)).toBe("https://www.prabhatasamgiita.org")
    expect(publicRedirectUrl(request, "/account")).toBe("https://www.prabhatasamgiita.org/account")
    expect(requestIsSecure(request)).toBe(true)
  })

  it("falls back to NEXT_PUBLIC_SITE_URL when the request is only localhost:8080", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://yellow-desert-06a0d4a00.2.azurestaticapps.net"
    const request = new NextRequest("http://localhost:8080/api/auth/sign-out", {
      headers: { host: "localhost:8080" },
    })
    expect(resolvePublicSiteOrigin(request)).toBe(
      "https://yellow-desert-06a0d4a00.2.azurestaticapps.net",
    )
  })

  it("keeps local Next.js development on localhost:3000", () => {
    const request = new NextRequest("http://localhost:3000/signin", {
      headers: { host: "localhost:3000" },
    })
    expect(resolvePublicSiteOrigin(request)).toBe("http://localhost:3000")
  })

  it("redirects bare apex host to www", () => {
    const request = new NextRequest("https://prabhatasamgiita.org/songs/1?lang=en", {
      headers: {
        "x-forwarded-host": "prabhatasamgiita.org",
        "x-forwarded-proto": "https",
      },
    })
    expect(apexToWwwRedirectUrl(request)).toBe("https://www.prabhatasamgiita.org/songs/1?lang=en")
  })

  it("allows Google PKCE redirects on the public host", () => {
    const request = new NextRequest("http://localhost:8080/api/auth/google/token", {
      headers: {
        "x-forwarded-host": "www.prabhatasamgiita.org",
        "x-forwarded-proto": "https",
      },
    })
    expect(
      isAllowedWebOAuthRedirect(request, "https://www.prabhatasamgiita.org/auth/callback/google"),
    ).toBe(true)
    expect(isAllowedWebOAuthRedirect(request, "https://evil.test/auth/callback/google")).toBe(false)
  })
})
