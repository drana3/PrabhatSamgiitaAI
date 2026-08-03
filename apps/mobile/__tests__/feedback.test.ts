import { afterEach, describe, expect, it, vi } from "vitest"
import { createApiClient } from "@prabhat/core"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe("feedback client", () => {
  it("posts to /api/v1/feedback with the same payload shape as the website", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ feedback_id: "fb-1", status: "received", message: "Thank you" }, { status: 201 }),
    )
    globalThis.fetch = fetchMock
    const api = createApiClient({ baseUrl: "https://api.example.test" })
    await api.submitFeedback({
      category: "search",
      rating: 4,
      comment: "Voice search found the right set",
      page_path: "/mobile/feedback",
      contact: "member@example.com",
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/feedback",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          category: "search",
          rating: 4,
          comment: "Voice search found the right set",
          page_path: "/mobile/feedback",
          contact: "member@example.com",
        }),
      }),
    )
  })
})
