import React from "react"
import { render, screen } from "@testing-library/react"

import { QuizBoard } from "@/components/quiz-board"

vi.mock("@/components/member-provider", () => ({
  useMember: () => ({ loading: false, session: { authenticated: false } }),
}))

describe("QuizBoard", () => {
  it("asks guests to sign in", () => {
    render(<QuizBoard />)
    expect(screen.getByRole("heading", { name: /Sign in to take the quiz/i })).toBeVisible()
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin")
  })
})
