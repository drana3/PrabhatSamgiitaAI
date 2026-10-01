import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"

import { GET } from "@/app/api/auth/sign-out/route"
import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import { buildClientPrincipal } from "@/lib/azure-principal"

describe("GET /api/auth/sign-out", () => {
  it("logs out of Easy Auth on the public host, not localhost:8080", async () => {
    const principal = buildClientPrincipal("oid-1", "member@example.com", "aad", "member@example.com")
    const request = new NextRequest("http://localhost:8080/api/auth/sign-out", {
      headers: {
        host: "localhost:8080",
        "x-forwarded-host": "www.prabhatasamgiita.org",
        "x-forwarded-proto": "https",
      },
    })
    request.cookies.set(LOCAL_AUTH_COOKIE, principal)

    const response = await GET(request)
    const location = response.headers.get("location") ?? ""
    expect(location).toContain("https://www.prabhatasamgiita.org/.auth/logout")
    expect(location).toContain(encodeURIComponent("https://www.prabhatasamgiita.org/?signedOut=1"))
    expect(location).not.toContain("localhost:8080")
  })
})
