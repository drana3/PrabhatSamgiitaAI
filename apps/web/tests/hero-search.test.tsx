import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { HeroSearch } from "@/components/hero-search"

const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))

afterEach(() => {
  push.mockClear()
  Reflect.deleteProperty(window, "webkitSpeechRecognition")
})

describe("hero search", () => {
  it("routes exact song numbers directly", async () => {
    const user = userEvent.setup()
    render(<HeroSearch />)
    await user.type(screen.getByLabelText(/Ask by song/i), "111")
    await user.click(screen.getByRole("button", { name: "Search" }))
    expect(push).toHaveBeenCalledWith("/songs/111#ask")
  })

  it("routes thematic queries to Explore", async () => {
    const user = userEvent.setup()
    render(<HeroSearch />)
    await user.type(screen.getByLabelText(/Ask by song/i), "morning meditation")
    await user.click(screen.getByRole("button", { name: "Search" }))
    expect(push).toHaveBeenCalledWith("/explore?q=morning%20meditation&kind=semantic")
  })

  it("opens grounded AI context for an explanation request containing a song number", async () => {
    const user = userEvent.setup()
    render(<HeroSearch />)
    await user.type(screen.getByLabelText(/Ask by song/i), "explain about prabhat sagiat 223")
    await user.click(screen.getByRole("button", { name: "Search" }))
    expect(push).toHaveBeenCalledWith("/songs/223#ask")
  })

  it("routes a spoken transliteration through the same intelligent search", async () => {
    class Recognition {
      lang = ""
      interimResults = false
      maxAlternatives = 1
      onresult: ((event: { results: { 0: { 0: { transcript: string } } } }) => void) | null = null
      onerror: (() => void) | null = null
      onend: (() => void) | null = null

      start() {
        this.onresult?.({ results: { 0: { 0: { transcript: "musafir aage badhte jana" }, length: 1 } } })
        this.onend?.()
      }
    }
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: Recognition })
    const user = userEvent.setup()
    render(<HeroSearch />)

    await user.click(await screen.findByRole("button", { name: "Search by voice" }))

    expect(screen.queryByRole("combobox", { name: "Spoken language" })).not.toBeInTheDocument()
    expect(push).toHaveBeenCalledWith("/explore?q=musafir%20aage%20badhte%20jana&kind=semantic&mode=voice&lang=auto")
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
