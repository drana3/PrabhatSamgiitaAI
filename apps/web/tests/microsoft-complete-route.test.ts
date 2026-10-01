import { describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

import { GET } from "@/app/api/auth/microsoft/complete/route"
import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import { buildClientPrincipal } from "@/lib/azure-principal"
import { OAUTH_RETURN_COOKIE } from "@/lib/oauth-return-cookie"

describe("GET /api/auth/microsoft/complete", () => {
  it("sets the member cookie from x-ms-client-principal and redirects home", async () => {
    const principal = buildClientPrincipal("oid-1", "member@example.com", "aad", "member@example.com")
    const request = new NextRequest("https://example.test/api/auth/microsoft/complete", {
      headers: {
        "x-ms-client-principal": principal,
        "x-forwarded-proto": "https",
      },
    })
    request.cookies.set(OAUTH_RETURN_COOKIE, encodeURIComponent("/account"))

    const response = await GET(request)
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("https://example.test/account")
    expect(response.cookies.get(LOCAL_AUTH_COOKIE)?.value).toBeTruthy()
  })

  it("redirects to the Microsoft callback page when SWA headers are missing", async () => {
    const request = new NextRequest("https://example.test/api/auth/microsoft/complete")
    const response = await GET(request)
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toContain("/auth/callback/microsoft")
    expect(response.cookies.get(LOCAL_AUTH_COOKIE)?.value).toBeUndefined()
  })

  it("does not send the browser to SWA localhost:8080", async () => {
    const principal = buildClientPrincipal("oid-1", "member@example.com", "aad", "member@example.com")
    const request = new NextRequest("http://localhost:8080/api/auth/microsoft/complete", {
      headers: {
        host: "localhost:8080",
        "x-forwarded-host": "www.prabhatasamgiita.org",
        "x-forwarded-proto": "https",
        "x-ms-client-principal": principal,
      },
    })
    request.cookies.set(OAUTH_RETURN_COOKIE, encodeURIComponent("/account"))

    const response = await GET(request)
    expect(response.headers.get("location")).toBe("https://www.prabhatasamgiita.org/account")
    expect(response.headers.get("location")).not.toContain("localhost:8080")
  })
})
