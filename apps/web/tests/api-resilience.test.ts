import { fetchSongs, fetchTodayRecommendations, searchSongs, submitFeedback } from "@/lib/api"

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
  vi.restoreAllMocks()
})

describe("API resilience", () => {
  it("keeps the interface usable when the catalog API fails", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("error", { status: 503 }))
    await expect(fetchSongs()).resolves.toEqual([])
  })

  it("rejects malformed catalog data instead of rendering broken cards", async () => {
    global.fetch = vi.fn().mockResolvedValue(Response.json([{ number: "one" }]))
    await expect(fetchSongs()).resolves.toEqual([])
  })

  it("blocks garbage search without making a request", async () => {
    const fetchMock = vi.fn()
    global.fetch = fetchMock
    await expect(searchSongs("djcvjcvhjcvhjc")).rejects.toThrow(/Please ask something specific/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("surfaces a useful server search error", async () => {
    global.fetch = vi.fn().mockResolvedValue(Response.json({ detail: "Search is warming up. Please retry." }, { status: 503 }))
    await expect(searchSongs("morning meditation")).rejects.toThrow("Search is warming up")
  })

  it("returns null for invalid contextual recommendation payloads", async () => {
    global.fetch = vi.fn().mockResolvedValue(Response.json({ recommendations: "wrong" }))
    await expect(fetchTodayRecommendations()).resolves.toBeNull()
  })

  it("returns the feedback acknowledgement", async () => {
    global.fetch = vi.fn().mockResolvedValue(Response.json({ message: "Thank you for the thoughtful feedback.", feedback_id: "abc" }, { status: 201 }))
    await expect(submitFeedback({ category: "experience", rating: 5, comment: "Beautiful experience" })).resolves.toMatchObject({ message: expect.stringContaining("Thank you") })
  })

  it("surfaces feedback rate limiting without losing the message", async () => {
    global.fetch = vi.fn().mockResolvedValue(Response.json({ detail: "Please wait before sending more feedback." }, { status: 429 }))
    await expect(submitFeedback({ category: "experience", rating: 1, comment: "Needs work" })).rejects.toThrow("Please wait")
  })
})
