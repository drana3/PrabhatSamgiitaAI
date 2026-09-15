import React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"

import {
  SongListenSidebar,
  SongListenTop,
  SongPageListenShell,
} from "@/components/song-page-listen"
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

const layoutState = vi.hoisted(() => ({ layout: "mobile" as "mobile" | "sidebar" }))

vi.mock("@/lib/use-song-page-layout", () => ({
  useSongPageLayout: () => layoutState.layout,
}))

vi.mock("@/components/member-provider", () => ({
  useMember: () => ({ loading: false, session: { authenticated: false } }),
}))

vi.mock("@/lib/warm-audio-stream", () => ({
  warmArchiveAudioStream: vi.fn().mockResolvedValue(undefined),
}))

afterEach(() => {
  layoutState.layout = "mobile"
  vi.restoreAllMocks()
})

describe("SongPageListenShell", () => {
  it("shows the compact player on mobile and the sidebar player on desktop", () => {
    const { rerender } = render(
      <SongPageListenShell songNumber={1} recordings={recordings}>
        <SongListenTop />
        <SongListenSidebar hasMeaning={false} />
      </SongPageListenShell>,
    )

    expect(screen.getByRole("button", { name: /Play Best/i })).toBeInTheDocument()
    expect(screen.queryByText(/Listen to this song/i)).not.toBeInTheDocument()

    layoutState.layout = "sidebar"
    rerender(
      <SongPageListenShell songNumber={1} recordings={recordings}>
        <SongListenTop />
        <SongListenSidebar hasMeaning={false} />
      </SongPageListenShell>,
    )

    expect(screen.getAllByRole("button", { name: /Play Best/i })).toHaveLength(1)
    expect(screen.getByText(/Listen to this song/i)).toBeInTheDocument()
    expect(within(screen.getByTestId("listen-sidebar")).getByLabelText(/Listen to Best/i)).toBeInTheDocument()
  })

  it("keeps alternate recordings in sync between top and sidebar", () => {
    layoutState.layout = "sidebar"
    render(
      <SongPageListenShell songNumber={1} recordings={recordings}>
        <SongListenTop />
        <SongListenSidebar hasMeaning={false} />
      </SongPageListenShell>,
    )

    fireEvent.click(screen.getByRole("button", { name: /Alternate take/i }))
    expect(within(screen.getByTestId("listen-sidebar")).getByLabelText(/Listen to Alternate take/i)).toBeInTheDocument()
  })
})
