import React from "react"
import { render, screen, waitFor } from "@testing-library/react"

import { CommunityFeedbackTicker } from "@/components/community-feedback-ticker"
import { fetchTestimonials } from "@/lib/api"
import { publishCommunityFeedback } from "@/lib/community-voices"

vi.mock("@/lib/api", () => ({ fetchTestimonials: vi.fn() }))
const fetchTestimonialsMock = vi.mocked(fetchTestimonials)

afterEach(() => vi.clearAllMocks())

describe("CommunityFeedbackTicker", () => {
  it("shows fallback voices when the API returns none", async () => {
    fetchTestimonialsMock.mockResolvedValue([])
    render(<CommunityFeedbackTicker />)
    expect((await screen.findAllByText(/Ananda D\./)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Kolkata, India/).length).toBeGreaterThan(0)
  })

  it("prefers approved API testimonials and prepends live feedback", async () => {
    fetchTestimonialsMock.mockResolvedValue([
      {
        display_name: "Test Devotee",
        display_location: "Varanasi, India",
        quote_text: "The AI companion keeps my evening listening grounded.",
      },
    ])
    render(<CommunityFeedbackTicker />)
    await waitFor(() => expect(screen.getAllByText(/Test Devotee/).length).toBeGreaterThan(0))

    publishCommunityFeedback({
      display_name: "Riya",
      display_location: "Pune, India",
      quote_text: "This tool helps me reflect after each song.",
    })

    expect((await screen.findAllByText(/Riya/)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Pune, India/).length).toBeGreaterThan(0)
  })
})
