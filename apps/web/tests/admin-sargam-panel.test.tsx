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
        json: async () => ({
          song_number: 5,
          source_scale: "C",
          tempo_bpm: 100,
          can_submit: false,
          submitted: false,
          notation_enabled: false,
        }),
      })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<AdminSargamPanel initialNumber={5} />)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Hide learners" })).toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: "Show learners" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Hide learners" })).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(screen.getByRole("button", { name: "Hide learners" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/sargam-capture/5/visibility",
        expect.objectContaining({ method: "POST" }),
      )
    })
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Hide learners" })).toHaveAttribute("aria-pressed", "true")
      expect(screen.getByText(/Hidden from learners until you show it again/i)).toBeInTheDocument()
    })
  })

  it("defaults missing notation_enabled to visible for the learner toggle", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        const { notation_enabled: _ignored, ...captureWithoutFlag } = capture
        return captureWithoutFlag
      },
    }) as unknown as typeof fetch

    render(<AdminSargamPanel initialNumber={5} />)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Show learners" })).toHaveAttribute("aria-pressed", "true")
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

  it("merges slim mutation responses after pasted sargam save", async () => {
    const mutation = {
      song_number: 5,
      source_scale: "C",
      tempo_bpm: 100,
      can_submit: false,
      submitted: false,
      line: {
        line_number: 1,
        lyric: "First lyric line",
        status: "recorded",
        events: [{ sargam: "S", western: "C4", startSec: 0, durationSec: 0.6 }],
        sargam: "Sa",
      },
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => capture })
      .mockResolvedValueOnce({ ok: true, json: async () => mutation })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<AdminSargamPanel initialNumber={5} />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Sa Re Ga Ma Pa/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/Sa Re Ga Ma Pa/i), {
      target: { value: "Sa Re Ga" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Save pasted sargam/i }))

    await waitFor(() => {
      expect(screen.getByText(/Line 1 · recorded/i)).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/sargam-capture/5/lines/1/takes",
      expect.objectContaining({ method: "POST" }),
    )
  })
})
