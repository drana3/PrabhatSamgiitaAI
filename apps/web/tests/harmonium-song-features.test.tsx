import React from "react"
import { render } from "@testing-library/react"
import { vi } from "vitest"

import { HarmoniumPracticeSection } from "@/components/harmonium-song-features"

vi.mock("@/components/harmonium-practice", () => ({
  HarmoniumPractice: () => <div id="notation">Full harmonium</div>,
}))

describe("HarmoniumPracticeSection", () => {
  it("hides notation when the song has no verified booklet sargam", () => {
    const { container } = render(<HarmoniumPracticeSection songNumber={33} />)
    expect(container).toBeEmptyDOMElement()
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

  it("shows harmonium practice for guests when sargam is published", () => {
    render(<HarmoniumPracticeSection songNumber={1} />)
    expect(document.getElementById("notation")).toBeInTheDocument()
  })

  it("shows the notation section for song 4", () => {
    render(<HarmoniumPracticeSection songNumber={4} />)
    expect(document.getElementById("notation")).toBeInTheDocument()
  })

  it("shows the notation section for song 27", () => {
    render(<HarmoniumPracticeSection songNumber={27} />)
    expect(document.getElementById("notation")).toBeInTheDocument()
  })
})
