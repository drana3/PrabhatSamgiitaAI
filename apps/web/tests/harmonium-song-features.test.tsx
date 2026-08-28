import React from "react"
import { render, screen } from "@testing-library/react"
import { vi } from "vitest"

import { HarmoniumPracticeSection } from "@/components/harmonium-song-features"
import { HARMONIUM_GATE_TITLE } from "@prabhat/core"

vi.mock("@/components/member-provider", () => ({
  useMember: () => ({ session: { authenticated: false } }),
}))

vi.mock("@/lib/harmonium-practice-pref", () => ({
  useHarmoniumPracticeEnabled: () => false,
}))

vi.mock("@/components/harmonium-practice", () => ({
  HarmoniumPractice: () => <div>Full harmonium</div>,
}))

vi.mock("next/navigation", () => ({
    usePathname: () => "/songs/1",
}))

describe("HarmoniumPracticeSection gate", () => {
  it("hides notation when the song has no verified booklet sargam", () => {
    const { container } = render(<HarmoniumPracticeSection songNumber={33} />)
    expect(container).toBeEmptyDOMElement()
    expect(document.getElementById("notation")).not.toBeInTheDocument()
  })

  it("shows the notation section for admin-submitted sargam", () => {
    render(<HarmoniumPracticeSection songNumber={33} sourceStatus="admin_submitted" />)
    expect(document.getElementById("notation")).toBeInTheDocument()
  })

  it("hides expert-sheet songs that are not in the published booklet set", () => {
    const { container } = render(<HarmoniumPracticeSection songNumber={4961} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("hides notation when an admin has disabled it", () => {
    const { container } = render(
      <HarmoniumPracticeSection songNumber={1} notationEnabled={false} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the notation section for song 27", () => {
    render(<HarmoniumPracticeSection songNumber={27} />)
    expect(document.getElementById("notation")).toBeInTheDocument()
  })

  it("keeps #notation anchor with a sign-in prompt when practice is off", () => {
    render(<HarmoniumPracticeSection songNumber={1} />)
    expect(document.getElementById("notation")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: HARMONIUM_GATE_TITLE })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin?next=%2Fsongs%2F1")
  })
})
