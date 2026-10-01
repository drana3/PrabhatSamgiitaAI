import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"

import { GET } from "@/app/api/auth/google/complete/route"
import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"
import { buildClientPrincipal } from "@/lib/azure-principal"
import { OAUTH_RETURN_COOKIE } from "@/lib/oauth-return-cookie"

describe("GET /api/auth/google/complete", () => {
  it("does not send the browser to SWA localhost:8080", async () => {
    const principal = buildClientPrincipal("gid-1", "member@example.com", "google", "member@example.com")
    const request = new NextRequest("http://localhost:8080/api/auth/google/complete", {
      headers: {
        host: "localhost:8080",
        "x-forwarded-host": "www.prabhatasamgiita.org",
        "x-forwarded-proto": "https",
        "x-ms-client-principal": principal,
      },
    })
    request.cookies.set(OAUTH_RETURN_COOKIE, encodeURIComponent("/saved"))

    const response = await GET(request)
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("https://www.prabhatasamgiita.org/saved")
    expect(response.cookies.get(LOCAL_AUTH_COOKIE)?.value).toBeTruthy()
  })
})
