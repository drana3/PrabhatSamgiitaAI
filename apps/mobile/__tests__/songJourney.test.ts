import { describe, expect, it } from "vitest"

import {
  journeyMarqueeCycleWidth,
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

  it("keeps Lyrics and Notation before Listen and Watch", () => {
    const { learn, media } = partitionSongJourneyTabs(
      visibleSongJourneyTabs({ hasVideo: true, harmoniumEnabled: true, hasFullSargam: true }),
    )
    expect(learn.map((t) => t.id)).toEqual(["understand", "notation"])
    expect(media.map((t) => t.id)).toEqual(["listen", "watch"])
  })

  it("hides Watch when there is no video", () => {
    const tabs = visibleSongJourneyTabs({ hasVideo: false, harmoniumEnabled: true, hasFullSargam: true }).map((t) => t.id)
    expect(tabs).toEqual(["understand", "notation", "listen"])
    expect(partitionSongJourneyTabs(visibleSongJourneyTabs({ hasVideo: false, harmoniumEnabled: true, hasFullSargam: true })).media.map((t) => t.id)).toEqual(["listen"])
  })

  it("hides Notation when harmonium practice is off", () => {
    const tabs = visibleSongJourneyTabs({ hasVideo: true, harmoniumEnabled: false }).map((t) => t.id)
    expect(tabs).toEqual(["understand", "listen", "watch"])
  })

  it("hides Notation when the song has no full sargam", () => {
    const tabs = visibleSongJourneyTabs({ hasVideo: true, harmoniumEnabled: true, hasFullSargam: false }).map((t) => t.id)
    expect(tabs).toEqual(["understand", "listen", "watch"])
  })

  it("shows Notation when harmonium practice is enabled", () => {
    const tabs = visibleSongJourneyTabs({ hasVideo: false, harmoniumEnabled: true, hasFullSargam: true }).map((t) => t.id)
    expect(tabs).toEqual(["understand", "notation", "listen"])
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
    expect(songWatchLayout("listen", { hasVideo: true, watchPlaying: true }).collapsePlayer).toBe(true)
  })

  it("hides video when it is not playing", () => {
    expect(songWatchLayout("understand", { hasVideo: true, watchPlaying: false })).toEqual({
      showPlayer: false,
      collapsePlayer: false,
      showKeepAliveBar: false,
    })
  })
})

describe("journeyMarqueeCycleWidth", () => {
  it("adds the same gap at the loop join as between chips", () => {
    expect(journeyMarqueeCycleWidth(400, 12)).toBe(412)
  })
})
