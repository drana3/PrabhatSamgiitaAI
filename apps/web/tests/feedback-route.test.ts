import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

import { buildClientPrincipal } from "@/lib/azure-principal"
import { LOCAL_AUTH_COOKIE } from "@/lib/auth-providers"

const backendResponse = vi.fn()

vi.mock("@/lib/member-admin-proxy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/member-admin-proxy")>()
  return {
    ...actual,
    backendBaseUrl: () => "https://api.test",
  }
})

describe("feedback API route", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    backendResponse.mockReset()
    vi.resetModules()
  })

  it("rejects anonymous feedback submissions", async () => {
    const { POST } = await import("@/app/api/feedback/route")
    const request = new NextRequest("https://example.test/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "experience",
        rating: 5,
        comment: "Beautiful experience",
      }),
    })

    const response = await POST(request as never)
    const body = await response.json()
    expect(response.status).toBe(401)
    expect(body.detail).toMatch(/sign in/i)
    expect(backendResponse).not.toHaveBeenCalled()
  })

  it("forwards feedback to the backend and attaches the signed-in email", async () => {
    backendResponse.mockResolvedValue(
      Response.json(
        { feedback_id: "abc-123", status: "received", message: "Thank you." },
        { status: 201 },
      ),
    )
    vi.stubGlobal("fetch", backendResponse)

    const { POST } = await import("@/app/api/feedback/route")
    const principal = buildClientPrincipal("user-1", "member@example.com")
    const request = new NextRequest("https://example.test/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ms-client-principal": principal,
      },
      body: JSON.stringify({
        category: "experience",
        rating: 5,
        comment: "Beautiful experience",
      }),
    })

    const response = await POST(request as never)
    expect(response.status).toBe(201)
    expect(String(backendResponse.mock.calls[0]?.[0])).toBe("https://api.test/api/v1/feedback")
    const forwardedBody = JSON.parse(String(backendResponse.mock.calls[0]?.[1]?.body))
    expect(forwardedBody.contact).toBe("member@example.com")
  })

  it("accepts feedback from local-auth cookie sessions", async () => {
    backendResponse.mockResolvedValue(
      Response.json(
        { feedback_id: "local-1", status: "received", message: "Thank you." },
        { status: 201 },
      ),
    )
    vi.stubGlobal("fetch", backendResponse)

    const { POST } = await import("@/app/api/feedback/route")
    const principal = buildClientPrincipal("local-user-1", "Ram", "local", "ram@example.com")
    const request = new NextRequest("https://example.test/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "experience",
        rating: 5,
        comment: "Baba Nam Kevalam, Great one",
      }),
    })
    request.cookies.set(LOCAL_AUTH_COOKIE, principal)

    const response = await POST(request as never)
    expect(response.status).toBe(201)
    const forwardedBody = JSON.parse(String(backendResponse.mock.calls[0]?.[1]?.body))
    expect(forwardedBody.contact).toBe("ram@example.com")
  })
})
