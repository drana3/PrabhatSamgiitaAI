import React from "react"
import { render, screen } from "@testing-library/react"

import { AudioRendition } from "@/components/audio-rendition"

const memberState = vi.hoisted(() => ({ authenticated: false }))
vi.mock("@/components/member-provider", () => ({
  useMember: () => ({ loading: false, session: memberState.authenticated ? { authenticated: true, display_name: "Ananda" } : { authenticated: false } }),
}))

afterEach(() => {
  vi.restoreAllMocks()
  memberState.authenticated = false
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
    expect(screen.queryByText(/Verified recording/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Download audio" })).not.toBeInTheDocument()
  })

  it("does not offer download to anonymous visitors", () => {
    render(<AudioRendition url="https://example.test/song.mp3" title="Song 1" />)
    expect(screen.queryByRole("link", { name: "Download audio" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("Listen to Song 1")).toHaveAttribute("controlsList", expect.stringContaining("nodownload"))
    expect(screen.getByText(/Sign in to enable/i)).toBeVisible()
  })

  it("offers download when the trusted member profile is authenticated", () => {
    memberState.authenticated = true
    render(<AudioRendition url="https://example.test/song.mp3" title="Song 1" />)
    expect(screen.getByRole("link", { name: "Download audio" })).toBeVisible()
    expect(screen.getByLabelText("Listen to Song 1").getAttribute("controlsList")).not.toContain("nodownload")
  })
})
