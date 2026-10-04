import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

import { GET as beginGoogle } from "@/app/api/auth/google/begin/route"
import { POST as startGoogle } from "@/app/api/auth/google/start/route"
import { POST as finishGoogle } from "@/app/api/auth/google/finish/route"
import { GOOGLE_PKCE_COOKIE } from "@/lib/google-oauth-server"
import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"

describe("Google OAuth server routes", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("begin GET redirects to Google and stores PKCE", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "google-client")
    const request = new NextRequest("https://example.test/api/auth/google/begin?next=%2Faccount", {
      method: "GET",
      headers: {
        "x-forwarded-host": "example.test",
        "x-forwarded-proto": "https",
      },
    })

    const response = await beginGoogle(request)
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toContain("accounts.google.com")
    expect(response.cookies.get(GOOGLE_PKCE_COOKIE)?.value).toContain("verifier")
  })

  it("stores a PKCE cookie and returns a Google authorize URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "google-client")
    const request = new NextRequest("https://example.test/api/auth/google/start", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-host": "example.test",
        "x-forwarded-proto": "https",
      },
      body: JSON.stringify({
        next: "/account",
        redirect_uri: "https://example.test/auth/callback/google",
      }),
    })

    const response = await startGoogle(request)
    const body = (await response.json()) as { url?: string }
    expect(response.status).toBe(200)
    expect(body.url).toContain("accounts.google.com")
    expect(body.url).toContain("code_challenge")
    expect(response.cookies.get(GOOGLE_PKCE_COOKIE)?.value).toContain("verifier")
  })

  it("exchanges the code on the server and sets the member cookie", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "google-client")
    const pkce = {
      verifier: "verifier-1",
      next: "/account",
      redirectUri: "https://example.test/auth/callback/google",
      state: "state-1",
      clientId: "google-client",
    }
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "ya29.token" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sub: "gid-1", email: "member@example.com", name: "Member" }),
        }),
    )

    const request = new NextRequest("https://example.test/api/auth/google/finish", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${GOOGLE_PKCE_COOKIE}=${encodeURIComponent(JSON.stringify(pkce))}`,
        "x-forwarded-proto": "https",
      },
      body: JSON.stringify({ code: "auth-code", state: "state-1" }),
    })

    const response = await finishGoogle(request)
    const body = (await response.json()) as { destination?: string }
    expect(response.status).toBe(200)
    expect(body.destination).toBe("/account")
    expect(response.cookies.get(LOCAL_AUTH_COOKIE)?.value).toBeTruthy()
  })
})
