import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { FavoriteSongButton } from "@/components/favorite-song-button"
import { addFavoriteSong } from "@/lib/member"

const refresh = vi.fn()
const useMemberMock = vi.fn()

vi.mock("@/components/member-provider", () => ({
  useMember: () => useMemberMock(),
}))

vi.mock("@/lib/member", () => ({
  addFavoriteSong: vi.fn().mockResolvedValue({ ok: true, favorites: [135] }),
  removeFavoriteSong: vi.fn().mockResolvedValue({ ok: true, favorites: [] }),
}))

const addFavoriteSongMock = vi.mocked(addFavoriteSong)

describe("FavoriteSongButton", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_ENABLED", "true")
    refresh.mockReset()
    addFavoriteSongMock.mockReset()
    addFavoriteSongMock.mockResolvedValue({ ok: true, favorites: [135] })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("prompts guests to sign in", () => {
    useMemberMock.mockReturnValue({ loading: false, session: { authenticated: false }, refresh })
    render(<FavoriteSongButton songNumber={135} />)
    expect(screen.getByRole("link", { name: "♡ Save song" })).toHaveAttribute("href", "/signin?next=%2Fsongs%2F135")
  })

  it("saves a song for signed-in members", async () => {
    const user = userEvent.setup()
    useMemberMock.mockReturnValue({
      loading: false,
      session: { authenticated: true, favorite_song_numbers: [] },
      refresh,
    })
    render(<FavoriteSongButton songNumber={135} />)
    await user.click(screen.getByRole("button", { name: "Save to Saved songs" }))
    expect(refresh).toHaveBeenCalledWith({ silent: true })
    expect(await screen.findByRole("status")).toHaveTextContent("Saved — open Account to see your Saved songs.")
  })

  it("explains auth failures instead of a generic playlist error", async () => {
    const user = userEvent.setup()
    addFavoriteSongMock.mockResolvedValue({ ok: false, error: "Sign in is required" })
    useMemberMock.mockReturnValue({
      loading: false,
      session: { authenticated: true, favorite_song_numbers: [] },
      refresh,
    })
    render(<FavoriteSongButton songNumber={135} />)
    await user.click(screen.getByRole("button", { name: "Save to Saved songs" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Please sign in again to update your playlist.")
  })

  it("shows saved state for favorited songs", () => {
    useMemberMock.mockReturnValue({
      loading: false,
      session: { authenticated: true, favorite_song_numbers: [135] },
      refresh,
    })
    render(<FavoriteSongButton songNumber={135} />)
    expect(screen.getByRole("button", { name: "Remove from Saved songs" })).toHaveTextContent("♥ Saved")
  })

  it("does not pretend playlist writes work when member backend is unavailable", async () => {
    const user = userEvent.setup()
    useMemberMock.mockReturnValue({
      loading: false,
      session: {
        authenticated: true,
        favorite_song_numbers: [],
        member_backend: false,
      },
      refresh,
    })
    render(<FavoriteSongButton songNumber={135} />)
    await user.click(screen.getByRole("button", { name: "Save to Saved songs" }))
    expect(addFavoriteSongMock).not.toHaveBeenCalled()
    expect(await screen.findByRole("status")).toHaveTextContent("Playlist saving is temporarily unavailable.")
  })
})
