import React from "react"
import { render, screen, waitFor } from "@testing-library/react"

import { CommunityFeedbackTicker } from "@/components/community-feedback-ticker"
import { fetchTestimonials } from "@/lib/api"

vi.mock("@/lib/api", () => ({ fetchTestimonials: vi.fn() }))
const fetchTestimonialsMock = vi.mocked(fetchTestimonials)

afterEach(() => vi.clearAllMocks())

describe("CommunityFeedbackTicker", () => {
  it("renders nothing when there are no approved testimonials", () => {
    fetchTestimonialsMock.mockResolvedValue([])
    const { container } = render(<CommunityFeedbackTicker />)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows approved API testimonials only", async () => {
    fetchTestimonialsMock.mockResolvedValue([
      {
        display_name: "Test Devotee",
        display_location: "Varanasi, India",
        quote_text: "The AI companion keeps my evening listening grounded.",
      },
    ])
    render(<CommunityFeedbackTicker />)
    await waitFor(() => expect(screen.getAllByText(/Test Devotee/).length).toBeGreaterThan(0))
    expect(screen.getAllByText(/Varanasi, India/).length).toBeGreaterThan(0)
  })
})
