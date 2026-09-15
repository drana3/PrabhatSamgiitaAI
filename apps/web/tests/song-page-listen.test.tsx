import React from "react"
import { render, screen } from "@testing-library/react"

import { SongPageListen } from "@/components/song-page-listen"

vi.mock("@/components/member-provider", () => ({
  useMember: () => ({
    loading: false,
    session: { authenticated: false },
  }),
}))

const recordings = [
  {
    title: "Song 1",
    url: "https://example.test/song.mp3",
    provider: "official",
    isLatest: true,
    isOlder: false,
    isLowQuality: false,
  },
]

describe("SongPageListen", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders the primary player before the xl breakpoint is known", () => {
    render(<SongPageListen placement="primary" songNumber={1} recordings={recordings} />)
    expect(screen.getByLabelText(/Listen to/i)).toBeInTheDocument()
  })

  it("does not render the sidebar player before the xl breakpoint is known", () => {
    render(<SongPageListen placement="sidebar" songNumber={1} recordings={recordings} />)
    expect(screen.queryByLabelText(/Listen to/i)).not.toBeInTheDocument()
  })
})
