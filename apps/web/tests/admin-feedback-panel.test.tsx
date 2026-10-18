import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { AdminFeedbackPanel } from "@/components/admin-feedback-panel"

describe("AdminFeedbackPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("retries from the browser when the server-side load failed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 1,
        items: [{
          feedback_id: "fb-1",
          category: "search",
          rating: 5,
          comment: "Search felt calm",
          page_path: "/explore",
          contact: null,
          status: "new",
          created_at: "2026-08-02T12:00:00+00:00",
          priority: false,
        }],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(
      <AdminFeedbackPanel
        initialStatus="new"
        initialData={{ total: 0, items: [], error: "Sign in is required" }}
      />,
    )

    expect(await screen.findByText("Search felt calm")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/feedback?status=new",
      expect.objectContaining({ credentials: "same-origin" }),
    )
  })

  it("offers a publish control for the live ticker", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 1,
        items: [{
          feedback_id: "fb-live",
          category: "experience",
          rating: 5,
          comment: "Prabhat Samgiita AI brings calm into my practice",
          page_path: "/",
          contact: null,
          status: "new",
          created_at: "2026-08-02T12:00:00+00:00",
          priority: false,
          on_live_ticker: false,
        }],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<AdminFeedbackPanel initialStatus="new" />)
    expect(await screen.findByRole("button", { name: "Show on live ticker" })).toBeInTheDocument()
  })

  it("lets the admin retry after a failed client load", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: "Could not load feedback" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total: 1,
          items: [{
            feedback_id: "fb-2",
            category: "ai",
            rating: 4,
            comment: "Companion helped me",
            page_path: "/songs/1",
            contact: null,
            status: "new",
            created_at: "2026-08-02T12:00:00+00:00",
            priority: false,
          }],
        }),
      })
    vi.stubGlobal("fetch", fetchMock)

    render(<AdminFeedbackPanel initialStatus="new" />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load feedback")

    await userEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Companion helped me")).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })
})
