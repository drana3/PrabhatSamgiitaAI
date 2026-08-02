import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { FeedbackWidget } from "@/components/feedback-widget"
import { submitFeedback } from "@/lib/api"

vi.mock("@/lib/api", () => ({ submitFeedback: vi.fn() }))
vi.mock("@/components/member-provider", () => ({
  useMember: () => ({ loading: false, session: { authenticated: false } }),
}))
const submitFeedbackMock = vi.mocked(submitFeedback)

afterEach(() => vi.clearAllMocks())

describe("feedback widget", () => {
  it("does not submit blank feedback", async () => {
    const user = userEvent.setup()
    render(<FeedbackWidget />)
    await user.click(screen.getByRole("button", { name: "Feedback" }))
    await user.click(screen.getByRole("button", { name: "Send feedback" }))
    expect(submitFeedbackMock).not.toHaveBeenCalled()
    expect(screen.getByRole("status")).toHaveTextContent("at least a few words")
  })

  it("submits rating, category, comment, and current page", async () => {
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
    expect(submitFeedbackMock).toHaveBeenCalledWith(expect.objectContaining({ category: "search", rating: 4, comment: "Search felt calm and fast" }))
    expect(await screen.findByRole("status")).toHaveTextContent("received")
  })
})
