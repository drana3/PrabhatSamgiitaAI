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

function mockMatchMedia(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

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

  it("shows the sidebar player on xl viewports", async () => {
    mockMatchMedia(true)
    render(<SongPageListen placement="sidebar" songNumber={1} recordings={recordings} />)
    expect(await screen.findByLabelText(/Listen to/i)).toBeInTheDocument()
  })

  it("hides the primary player on xl viewports", async () => {
    mockMatchMedia(true)
    render(<SongPageListen placement="primary" songNumber={1} recordings={recordings} />)
    expect(screen.queryByLabelText(/Listen to/i)).not.toBeInTheDocument()
  })
})
