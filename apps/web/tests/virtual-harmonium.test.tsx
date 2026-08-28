import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { VirtualHarmonium } from "@/components/virtual-harmonium"
import * as playback from "@/lib/harmonium-playback"

vi.mock("@/lib/harmonium-playback", () => ({
  playSheetEvents: vi.fn(),
  playSheetOnTransport: vi.fn(),
  startWesternNote: vi.fn(async () => () => undefined),
  stopActiveWesternNote: vi.fn(),
  ensureHarmoniumPlayer: vi.fn(async () => true),
  setHarmoniumBellows: vi.fn(),
  setHarmoniumFineTune: vi.fn(),
  setHarmoniumVoiceRegister: vi.fn(),
  startHarmoniumDrone: vi.fn(async () => undefined),
  stopHarmoniumDrone: vi.fn(),
  pauseHarmoniumSheet: vi.fn(),
  resumeHarmoniumSheet: vi.fn(),
  stopHarmoniumSheet: vi.fn(),
  getHarmoniumSheetSeconds: vi.fn(() => 0),
  retargetHarmoniumSheet: vi.fn(),
}))

describe("VirtualHarmonium", () => {
  it("renders a chromatic keyboard, sample song, and type-to-play input", () => {
    render(<VirtualHarmonium tonic="C" />)

    expect(screen.getByRole("group", { name: "Virtual harmonium keyboard" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Virtual harmonium keyboard" }).querySelectorAll("button")).toHaveLength(25)
    expect(screen.getByRole("button", { name: "Play on keys" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "⏸ Pause" })).toBeDisabled()
    expect(screen.getByLabelText("Harmonium fine tune")).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Voice range" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Bass" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Male" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Female" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "High" })).toBeInTheDocument()
    expect(screen.getAllByText(/Pa á á ma/).length).toBeGreaterThan(0)
    expect(screen.getByRole("heading", { name: "Bandhu He Niye Calo" })).toBeInTheDocument()
    expect(screen.getByLabelText("Tempo tuner")).toBeInTheDocument()
    expect(screen.getByLabelText("Type sargam")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "▶ Play" })).toBeDisabled()
  })

  it("fills example sargam when a chip is tapped", () => {
    render(<VirtualHarmonium tonic="C" />)
    fireEvent.click(screen.getByRole("button", { name: "Sa Re Ga Ma Pa Dha Ni Sa′" }))
    expect(screen.getByLabelText("Type sargam")).toHaveValue("Sa Re Ga Ma Pa Dha Ni Sa′")
  })

  it("lets Play on keys resume after pause", async () => {
    vi.mocked(playback.playSheetEvents).mockImplementationOnce(() => new Promise(() => undefined))
    render(<VirtualHarmonium tonic="C" />)

    fireEvent.click(screen.getByRole("button", { name: "Play on keys" }))
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Play on keys" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Play on keys" })).toHaveTextContent("Playing…")
    })

    fireEvent.click(screen.getByRole("button", { name: "⏸ Pause" }))
    expect(playback.pauseHarmoniumSheet).toHaveBeenCalled()
    const play = screen.getByRole("button", { name: "Play on keys" })
    expect(play).toBeEnabled()

    fireEvent.click(play)
    expect(playback.resumeHarmoniumSheet).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Play on keys" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Play on keys" })).toHaveTextContent("Playing…")
    })
  })

  it("retargets the playing song when the tempo tuner changes", async () => {
    vi.mocked(playback.playSheetEvents).mockImplementationOnce(() => new Promise(() => undefined))
    vi.mocked(playback.getHarmoniumSheetSeconds).mockReturnValue(8)
    render(<VirtualHarmonium tonic="C" />)

    fireEvent.click(screen.getByRole("button", { name: "Play on keys" }))
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Play on keys" })).toHaveTextContent("Playing…")
    })

    fireEvent.click(screen.getByRole("button", { name: "Fast" }))
    await waitFor(() => {
      expect(playback.retargetHarmoniumSheet).toHaveBeenCalled()
    })
    const [, seconds, shouldPlay] = vi.mocked(playback.retargetHarmoniumSheet).mock.calls[0] ?? []
    expect(typeof seconds).toBe("number")
    expect(seconds).toBeGreaterThan(0)
    expect(shouldPlay).toBe(true)
  })
})
