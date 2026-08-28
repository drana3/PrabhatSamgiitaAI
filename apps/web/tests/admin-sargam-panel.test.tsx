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
  booklet_locked: false,
  source_scale: "C",
  tempo_bpm: 100,
  can_submit: false,
  submitted: false,
  notation_enabled: true,
  listen_url: "https://example.com/song.mp3",
  lines: [
    { line_number: 1, lyric: "First lyric line", status: "empty", events: [] },
    { line_number: 2, lyric: "Second lyric line", status: "empty", events: [] },
  ],
}

describe("AdminSargamPanel", () => {
  it("loads lyrics and opens the capture studio", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => capture,
    }) as unknown as typeof fetch

    render(<AdminSargamPanel initialNumber={5} />)

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Test song" })).toBeInTheDocument()
    })
    expect(screen.getByText("First lyric line")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Show learners" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Record" })).toBeInTheDocument()
    expect(screen.getByText("Virtual keyboard")).toBeInTheDocument()
  })

  it("lets an admin hide notation from learners", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => capture })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...capture, notation_enabled: false }),
      })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<AdminSargamPanel initialNumber={5} />)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Hide learners" })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole("button", { name: "Hide learners" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/sargam-capture/5/visibility",
        expect.objectContaining({ method: "POST" }),
      )
    })
  })

  it("steps between lyric lines in the capture studio", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => capture,
    }) as unknown as typeof fetch

    render(<AdminSargamPanel initialNumber={5} />)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Next line" })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Next line" }))
    expect(screen.getByText("Line 2: Second lyric line")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Previous line" }))
    expect(screen.getByText("Line 1: First lyric line")).toBeInTheDocument()
  })
})
