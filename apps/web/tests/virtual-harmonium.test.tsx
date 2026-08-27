import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { VirtualHarmonium } from "@/components/virtual-harmonium"

vi.mock("@/lib/harmonium-playback", () => ({
  playSheetEvents: vi.fn(),
  startWesternNote: vi.fn(async () => () => undefined),
  stopActiveWesternNote: vi.fn(),
}))

describe("VirtualHarmonium", () => {
  it("renders a chromatic keyboard, sample song, and type-to-play input", () => {
    render(<VirtualHarmonium tonic="C" />)

    expect(screen.getByRole("group", { name: "Virtual harmonium keyboard" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Virtual harmonium keyboard" }).querySelectorAll("button")).toHaveLength(25)
    expect(screen.getByRole("button", { name: "▶ Play on keys" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Raghupati Raghav Raja Ram" })).toBeInTheDocument()
    expect(screen.getByLabelText("Type sargam")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "▶ Play" })).toBeDisabled()
  })

  it("fills example sargam when a chip is tapped", () => {
    render(<VirtualHarmonium tonic="C" />)
    fireEvent.click(screen.getByRole("button", { name: "Sa Re Ga Ma Pa Dha Ni Sa′" }))
    expect(screen.getByLabelText("Type sargam")).toHaveValue("Sa Re Ga Ma Pa Dha Ni Sa′")
  })
})
