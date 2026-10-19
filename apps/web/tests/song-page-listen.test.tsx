import React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"

import { SongListenSidebar, SongPageListenShell } from "@/components/song-page-listen"
import type { RankedAudio } from "@prabhat/core"

const recordings: RankedAudio[] = [
  {
    title: "Best take",
    url: "https://example.test/best.mp3",
    provider: "official",
    isLatest: true,
    isOlder: false,
    isLowQuality: false,
  },
  {
    title: "Alternate take",
    url: "https://example.test/alt.mp3",
    provider: "official",
    isLatest: false,
    isOlder: false,
    isLowQuality: false,
  },
]

vi.mock("@/components/member-provider", () => ({
  useMember: () => ({ loading: false, session: { authenticated: false } }),
}))

vi.mock("@/lib/warm-audio-stream", () => ({
  warmArchiveAudioStream: vi.fn().mockResolvedValue(undefined),
}))

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("SongPageListenShell", () => {
  it("shows one listen panel that mounts audio only after Play", () => {
    render(
      <SongPageListenShell songNumber={1} recordings={recordings}>
        <SongListenSidebar hasMeaning={false} />
      </SongPageListenShell>,
    )

    expect(screen.getByText(/Listen to this song/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Play recording/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/Listen to Best/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/full player on the right/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Play recording/i }))
    expect(screen.getByLabelText(/Listen to Best/i)).toBeInTheDocument()
  })

  it("switches recordings from the listen panel list", () => {
    render(
      <SongPageListenShell songNumber={1} recordings={recordings}>
        <SongListenSidebar hasMeaning={false} />
      </SongPageListenShell>,
    )

    fireEvent.click(screen.getByRole("button", { name: /Alternate take/i }))
    const panel = screen.getByTestId("listen-sidebar")
    fireEvent.click(within(panel).getByRole("button", { name: /Play recording/i }))
    expect(within(panel).getByLabelText(/Listen to Alternate take/i)).toBeInTheDocument()
  })
})
