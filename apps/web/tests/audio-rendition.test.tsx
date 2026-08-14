import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"

import { AudioRendition } from "@/components/audio-rendition"

const memberState = vi.hoisted(() => ({ authenticated: false, loading: false }))
vi.mock("@/components/member-provider", () => ({
  useMember: () => ({
    loading: memberState.loading,
    session: memberState.authenticated
      ? { authenticated: true, display_name: "Ananda" }
      : { authenticated: false },
  }),
}))

afterEach(() => {
  vi.restoreAllMocks()
  memberState.authenticated = false
  memberState.loading = false
})

describe("authenticated audio controls", () => {
  it("uses clear recording language for verified sources", () => {
    render(<AudioRendition url="https://example.test/song.mp3" title="Song 1" provider="official" />)

    expect(screen.getByText("Verified recording")).toBeInTheDocument()
  })

  it("shows compact transport controls for the lyrics header player", () => {
    render(<AudioRendition url="https://example.test/song.mp3" title="Song 8" provider="official" compact />)

    expect(screen.getByRole("button", { name: /Play Song 8/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Rewind 10 seconds/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Forward 10 seconds/i })).toBeInTheDocument()
    expect(screen.getByRole("slider", { name: /Seek through Song 8/i })).toBeInTheDocument()
    expect(screen.getByRole("slider", { name: /Volume for Song 8/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Mute/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Mute/i })).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(screen.getByRole("button", { name: /Mute/i }))
    expect(screen.getByRole("button", { name: /Unmute/i })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByText(/Verified recording/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Download audio" })).not.toBeInTheDocument()
  })

  it("does not offer download to anonymous visitors", () => {
    render(<AudioRendition url="https://example.test/song.mp3" title="Song 1" />)
    expect(screen.queryByRole("link", { name: "Download audio" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Listen to Song 1")).toHaveAttribute("controlsList", expect.stringContaining("nodownload"))
    expect(screen.getByText(/Sign in to enable download from the player menu/i)).toBeVisible()
  })

  it("keeps download disabled while the member session is loading", () => {
    memberState.loading = true
    memberState.authenticated = true
    render(<AudioRendition url="https://example.test/song.mp3" title="Song 1" />)
    expect(screen.getByLabelText("Listen to Song 1")).toHaveAttribute("controlsList", expect.stringContaining("nodownload"))
  })

  it("enables player-menu download for authenticated members", () => {
    memberState.authenticated = true
    render(<AudioRendition url="https://example.test/song.mp3" title="Song 1" />)
    expect(screen.queryByRole("link", { name: "Download audio" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Listen to Song 1").getAttribute("controlsList")).not.toContain("nodownload")
    expect(screen.queryByText(/Sign in to enable/i)).not.toBeInTheDocument()
  })
})
