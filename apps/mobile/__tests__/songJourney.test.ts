import { describe, expect, it } from "vitest"

import {
  isMediaSongJourneyTab,
  partitionSongJourneyTabs,
  songJourneyTabs,
  songWatchLayout,
  visibleSongJourneyTabs,
} from "@/constants/songJourney"

describe("visibleSongJourneyTabs", () => {
  it("keeps Lyrics and Notation together, then Listen and Watch", () => {
    expect(songJourneyTabs.map((t) => t.id)).toEqual([
      "understand",
      "notation",
      "listen",
      "watch",
    ])
    expect(songJourneyTabs.find((t) => t.id === "understand")?.label).toBe("Lyrics & Meaning")
    expect(isMediaSongJourneyTab("listen")).toBe(true)
    expect(isMediaSongJourneyTab("watch")).toBe(true)
    expect(isMediaSongJourneyTab("understand")).toBe(false)
    expect(isMediaSongJourneyTab("notation")).toBe(false)
  })

  it("puts a physical gap between learn chips and Listen/Watch", () => {
    const { learn, media } = partitionSongJourneyTabs(
      visibleSongJourneyTabs({ hasVideo: true, hasNotation: true }),
    )
    expect(learn.map((t) => t.id)).toEqual(["understand", "notation"])
    expect(media.map((t) => t.id)).toEqual(["listen", "watch"])
  })

  it("hides Watch when there is no video", () => {
    const tabs = visibleSongJourneyTabs({ hasVideo: false, hasNotation: true }).map((t) => t.id)
    expect(tabs).toEqual(["understand", "notation", "listen"])
    expect(partitionSongJourneyTabs(visibleSongJourneyTabs({ hasVideo: false, hasNotation: true })).media.map((t) => t.id)).toEqual(["listen"])
  })

  it("hides Notation when harmonium data is missing", () => {
    const tabs = visibleSongJourneyTabs({ hasVideo: true, hasNotation: false }).map((t) => t.id)
    expect(tabs).toEqual(["understand", "listen", "watch"])
  })
})

describe("songWatchLayout", () => {
  it("shows the full Watch panel only on the Watch tab", () => {
    expect(songWatchLayout("watch", { hasVideo: true, watchPlaying: true })).toEqual({
      showPlayer: true,
      collapsePlayer: false,
      showKeepAliveBar: false,
    })
  })

  it("keeps video mounted but collapsed when Lyrics is focused", () => {
    expect(songWatchLayout("understand", { hasVideo: true, watchPlaying: true })).toEqual({
      showPlayer: true,
      collapsePlayer: true,
      showKeepAliveBar: true,
    })
  })

  it("hides video when it is not playing", () => {
    expect(songWatchLayout("understand", { hasVideo: true, watchPlaying: false })).toEqual({
      showPlayer: false,
      collapsePlayer: false,
      showKeepAliveBar: false,
    })
  })
})
