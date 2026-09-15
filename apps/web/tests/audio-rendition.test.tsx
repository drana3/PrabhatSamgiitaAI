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

  it("uses native browser controls with metadata preload on the primary player", () => {
    render(<AudioRendition url="https://example.test/song.mp3" title="Song 8" provider="official" warmStream />)

    const player = screen.getByLabelText("Listen to Song 8")
    expect(player).toHaveAttribute("controls")
    expect(player).toHaveAttribute("preload", "metadata")
    expect(screen.getByText("Verified recording")).toBeInTheDocument()
  })

  it("defers network fetch on secondary players until play", () => {
    render(<AudioRendition url="https://example.test/song.mp3" title="Song 8" provider="official" />)
    expect(screen.getByLabelText("Listen to Song 8")).toHaveAttribute("preload", "none")
  })

  it("shows a helpful message when the recording fails to load", () => {
    render(<AudioRendition url="https://example.test/song.mp3" title="Song 8" provider="official" />)
    fireEvent.error(screen.getByLabelText("Listen to Song 8"))
    expect(screen.getByRole("alert")).toHaveTextContent(/Couldn't load this recording/i)
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
