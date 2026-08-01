import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { HeroSearch } from "@/components/hero-search"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))

afterEach(() => push.mockClear())

describe("hero search", () => {
  it("routes exact song numbers directly", async () => {
    const user = userEvent.setup()
    render(<HeroSearch />)
    await user.type(screen.getByLabelText(/Ask by song/i), "111")
    await user.click(screen.getByRole("button", { name: "Search" }))
    expect(push).toHaveBeenCalledWith("/songs/111")
  })

  it("routes thematic queries to Explore", async () => {
    const user = userEvent.setup()
    render(<HeroSearch />)
    await user.type(screen.getByLabelText(/Ask by song/i), "morning meditation")
    await user.click(screen.getByRole("button", { name: "Search" }))
    expect(push).toHaveBeenCalledWith("/explore?q=morning%20meditation")
  })

  it("opens grounded AI context for an explanation request containing a song number", async () => {
    const user = userEvent.setup()
    render(<HeroSearch />)
    await user.type(screen.getByLabelText(/Ask by song/i), "explain about prabhat sagiat 223")
    await user.click(screen.getByRole("button", { name: "Search" }))
    expect(push).toHaveBeenCalledWith("/songs/223#ask")
  })

  it("keeps malicious and meaningless input local", async () => {
    const user = userEvent.setup()
    render(<HeroSearch />)
    await user.type(screen.getByLabelText(/Ask by song/i), "<script>alert(1)</script>")
    await user.click(screen.getByRole("button", { name: "Search" }))
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("Please ask something specific")
  })
})
