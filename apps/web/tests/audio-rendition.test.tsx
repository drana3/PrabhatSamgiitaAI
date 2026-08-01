import React from "react"
import { render, screen, waitFor } from "@testing-library/react"

import { AudioRendition } from "@/components/audio-rendition"

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("authenticated audio controls", () => {
  it("does not offer download to anonymous visitors", async () => {
    global.fetch = vi.fn().mockResolvedValue(Response.json([]))
    render(<AudioRendition url="https://example.test/song.mp3" title="Song 1" />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/.auth/me", expect.anything()))
    expect(screen.queryByRole("link", { name: "Download audio" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Listen to Song 1")).toHaveAttribute("controlsList", expect.stringContaining("nodownload"))
    expect(screen.getByText(/Sign in to enable/i)).toBeVisible()
  })

  it("keeps download disabled until member profile sync is enabled", async () => {
    global.fetch = vi.fn().mockResolvedValue(Response.json([{ user_id: "member" }]))
    render(<AudioRendition url="https://example.test/song.mp3" title="Song 1" />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(screen.queryByRole("link", { name: "Download audio" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Listen to Song 1").getAttribute("controlsList")).toContain("nodownload")
  })

  it("offers download when profile sync is enabled and Easy Auth confirms a user", async () => {
    vi.stubEnv("NEXT_PUBLIC_MEMBER_DOWNLOADS_ENABLED", "true")
    global.fetch = vi.fn().mockResolvedValue(Response.json([{ user_id: "member" }]))
    render(<AudioRendition url="https://example.test/song.mp3" title="Song 1" />)
    expect(await screen.findByRole("link", { name: "Download audio" })).toBeVisible()
    expect(screen.getByLabelText("Listen to Song 1").getAttribute("controlsList")).not.toContain("nodownload")
  })
})
