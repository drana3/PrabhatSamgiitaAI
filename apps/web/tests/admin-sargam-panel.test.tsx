import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AdminSargamPanel } from "@/components/admin-sargam-panel"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/components/virtual-harmonium", () => ({
  VirtualHarmonium: () => <div>Virtual keyboard</div>,
}))

vi.mock("@/lib/harmonium-playback", () => ({
  playSheetEvents: vi.fn(),
}))

const capture = {
  song_number: 5,
  title: "Test song",
  meaning: "A light of devotion.",
  hindi_meaning: null,
  booklet_locked: false,
  source_scale: "C",
  tempo_bpm: 100,
  can_submit: false,
  submitted: false,
  notation_enabled: true,
  lines: [
    { line_number: 1, lyric: "First lyric line", status: "empty", events: [] },
    { line_number: 2, lyric: "Second lyric line", status: "empty", events: [] },
  ],
}

describe("AdminSargamPanel", () => {
  it("loads lyrics and meaning, then offers recording", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => capture,
    }) as unknown as typeof fetch

    render(<AdminSargamPanel />)
    fireEvent.change(screen.getByLabelText("Song number"), { target: { value: "5" } })
    fireEvent.click(screen.getByRole("button", { name: "Load lyrics" }))

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Test song" })).toBeInTheDocument()
    })
    expect(screen.getByText("A light of devotion.")).toBeInTheDocument()
    expect(screen.getByText("First lyric line")).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: "Show notation for this song" })).toHaveAttribute(
      "aria-checked",
      "true",
    )
    fireEvent.click(screen.getByRole("button", { name: "Start recording lyrics" }))
    expect(screen.getByText("Virtual keyboard")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Record" })).toBeInTheDocument()
  })

  it("lets an admin hide notation from learners", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => capture })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...capture, notation_enabled: false }),
      })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<AdminSargamPanel />)
    fireEvent.change(screen.getByLabelText("Song number"), { target: { value: "5" } })
    fireEvent.click(screen.getByRole("button", { name: "Load lyrics" }))
    await waitFor(() => {
      expect(screen.getByRole("switch", { name: "Show notation for this song" })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole("switch", { name: "Show notation for this song" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/sargam-capture/5/visibility",
        expect.objectContaining({ method: "POST" }),
      )
    })
  })
})
