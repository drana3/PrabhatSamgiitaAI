import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { FavoriteSongButton } from "@/components/favorite-song-button"

const refresh = vi.fn()
const useMemberMock = vi.fn()

vi.mock("@/components/member-provider", () => ({
  useMember: () => useMemberMock(),
}))

vi.mock("@/lib/member", () => ({
  addFavoriteSong: vi.fn().mockResolvedValue([135]),
  removeFavoriteSong: vi.fn().mockResolvedValue([]),
}))

describe("FavoriteSongButton", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_ENABLED", "true")
    refresh.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("prompts guests to sign in", () => {
    useMemberMock.mockReturnValue({ loading: false, session: { authenticated: false }, refresh })
    render(<FavoriteSongButton songNumber={135} />)
    expect(screen.getByRole("link", { name: "♡ Save song" })).toHaveAttribute("href", "/signin?next=%2Fsongs%2F135%23ask")
  })

  it("saves a song for signed-in members", async () => {
    const user = userEvent.setup()
    useMemberMock.mockReturnValue({
      loading: false,
      session: { authenticated: true, favorite_song_numbers: [] },
      refresh,
    })
    render(<FavoriteSongButton songNumber={135} />)
    await user.click(screen.getByRole("button", { name: "Save to playlist" }))
    expect(refresh).toHaveBeenCalled()
    expect(await screen.findByRole("status")).toHaveTextContent("Saved to your playlist.")
  })

  it("shows saved state for favorited songs", () => {
    useMemberMock.mockReturnValue({
      loading: false,
      session: { authenticated: true, favorite_song_numbers: [135] },
      refresh,
    })
    render(<FavoriteSongButton songNumber={135} />)
    expect(screen.getByRole("button", { name: "Remove from playlist" })).toHaveTextContent("♥ Saved")
  })
})
