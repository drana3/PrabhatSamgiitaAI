import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AdminIngestionPanel } from "@/components/admin-ingestion-panel"

vi.mock("@/components/admin-shell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const preview = {
  song_number: 111,
  existing_lyrics: "Bandhu he niye calo",
  existing_meanings: { en: "This song speaks of devotion." },
  existing_audio_url: null,
  existing_video_url: null,
  existing_notation: null,
}

describe("AdminIngestionPanel", () => {
  it("loads existing DB content for a song", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => preview,
    }) as unknown as typeof fetch

    render(<AdminIngestionPanel />)
    fireEvent.click(screen.getByRole("button", { name: /Load existing DB content/i }))

    await waitFor(() => {
      expect(screen.getByText(/DB has 1 meaning language/i)).toBeInTheDocument()
    })
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin/ingestions/preview?song_number=1",
      expect.objectContaining({ cache: "no-store" }),
    )
  })

  it("checks meaning language through the admin API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => preview })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, message: "" }) })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<AdminIngestionPanel />)
    fireEvent.click(screen.getByRole("button", { name: /Load existing DB content/i }))
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Check language/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /Check language/i }))

    await waitFor(() => {
      expect(screen.getByText("Language check passed")).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ingestions/check-language",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("submits ingestion for super-admin approval", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => preview })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "sub-1",
          song_number: 111,
          status: "pending_super_admin",
          payload: {},
          language_warnings: [],
          review_note: null,
          submitted_by_email: "admin@test",
          created_at: "2026-08-31T00:00:00+00:00",
        }),
      })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<AdminIngestionPanel />)
    fireEvent.click(screen.getByRole("button", { name: /Load existing DB content/i }))
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Submit for super-admin approval/i })).toBeEnabled()
    })

    fireEvent.click(screen.getByRole("button", { name: /Submit for super-admin approval/i }))

    await waitFor(() => {
      expect(screen.getByText("Submitted for super-admin approval")).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ingestions",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"song_number":1'),
      }),
    )
  })

  it("lets a super-admin review pending submissions", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 1,
          items: [{ id: "sub-1", song_number: 111, status: "pending_super_admin" }],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "sub-1", status: "approved" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ total: 0, items: [] }),
      })
    global.fetch = fetchMock as unknown as typeof fetch

    render(<AdminIngestionPanel isSuperAdmin />)
    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }))

    await waitFor(() => {
      expect(screen.getByText("PS 111")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: /Approve/i }))

    await waitFor(() => {
      expect(screen.getByText("Submission approved and applied")).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/ingestions/sub-1/review",
      expect.objectContaining({ method: "POST" }),
    )
  })
})
