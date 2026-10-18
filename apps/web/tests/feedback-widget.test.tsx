import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { FeedbackWidget } from "@/components/feedback-widget"
import { submitFeedback } from "@/lib/api"

vi.mock("@/lib/api", () => ({ submitFeedback: vi.fn() }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/explore",
}))

const useMemberMock = vi.fn()
vi.mock("@/components/member-provider", () => ({
  useMember: () => useMemberMock(),
}))
const submitFeedbackMock = vi.mocked(submitFeedback)

afterEach(() => {
  vi.clearAllMocks()
})

describe("feedback widget", () => {
  it("asks guests to sign in instead of submitting feedback", async () => {
    useMemberMock.mockReturnValue({ loading: false, session: { authenticated: false } })
    const user = userEvent.setup()
    render(<FeedbackWidget />)
    await user.click(screen.getByRole("button", { name: "Feedback" }))
    expect(screen.getByRole("link", { name: "Sign in to send feedback" })).toHaveAttribute(
      "href",
      "/signin?next=%2Fexplore",
    )
    expect(screen.queryByRole("button", { name: "Send feedback" })).not.toBeInTheDocument()
    expect(submitFeedbackMock).not.toHaveBeenCalled()
  })

  it("does not submit blank feedback for signed-in members", async () => {
    useMemberMock.mockReturnValue({
      loading: false,
      session: {
        authenticated: true,
        id: "aad:1",
        display_name: "Member",
        identity_provider: "aad",
        personalization_enabled: true,
        favorite_song_numbers: [],
        is_admin: false,
      },
    })
    const user = userEvent.setup()
    render(<FeedbackWidget />)
    await user.click(screen.getByRole("button", { name: "Feedback" }))
    await user.click(screen.getByRole("button", { name: "Send feedback" }))
    expect(submitFeedbackMock).not.toHaveBeenCalled()
    expect(screen.getByRole("status")).toHaveTextContent("at least a few words")
  })

  it("submits rating, category, comment, and current page for signed-in members", async () => {
    useMemberMock.mockReturnValue({
      loading: false,
      session: {
        authenticated: true,
        id: "aad:1",
        display_name: "Member",
        identity_provider: "aad",
        personalization_enabled: true,
        favorite_song_numbers: [],
        is_admin: false,
      },
    })
    submitFeedbackMock.mockResolvedValue({
      message: "Thank you. Your feedback was received.",
      feedbackId: "abc-123",
    })
    const user = userEvent.setup()
    render(<FeedbackWidget />)
    await user.click(screen.getByRole("button", { name: "Feedback" }))
    await user.click(screen.getByRole("button", { name: "4 stars" }))
    await user.selectOptions(screen.getByLabelText("Area"), "search")
    await user.type(screen.getByLabelText("Your feedback"), "Search felt calm and fast")
    await user.click(screen.getByRole("button", { name: "Send feedback" }))
    expect(submitFeedbackMock).toHaveBeenCalledWith(expect.objectContaining({
      category: "search",
      rating: 4,
      comment: "Search felt calm and fast",
    }))
    expect(await screen.findByRole("status")).toHaveTextContent("received")
  })
})
