import { afterEach, describe, expect, it, vi } from "vitest"

import { buildClientPrincipal } from "@/lib/azure-principal"

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
    const request = new Request("https://example.test/api/feedback", {
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
})
