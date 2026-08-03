import { describe, expect, it } from "vitest"

import { songJourneyTabs, visibleSongJourneyTabs } from "@/constants/songJourney"

describe("visibleSongJourneyTabs", () => {
  it("keeps Listen → Lyrics & Meaning → Notation → Watch order", () => {
    expect(songJourneyTabs.map((t) => t.id)).toEqual([
      "listen",
      "understand",
      "notation",
      "watch",
    ])
    expect(songJourneyTabs.find((t) => t.id === "understand")?.label).toBe("Lyrics & Meaning")
  })

  it("hides Watch when there is no video", () => {
    const tabs = visibleSongJourneyTabs({ hasVideo: false, hasNotation: true }).map((t) => t.id)
    expect(tabs).toEqual(["listen", "understand", "notation"])
  })

  it("hides Notation when harmonium data is missing", () => {
    const tabs = visibleSongJourneyTabs({ hasVideo: true, hasNotation: false }).map((t) => t.id)
    expect(tabs).toEqual(["listen", "understand", "watch"])
  })

  it("shows Notation before Watch when both are available", () => {
    const tabs = visibleSongJourneyTabs({ hasVideo: true, hasNotation: true }).map((t) => t.id)
    expect(tabs).toEqual(["listen", "understand", "notation", "watch"])
  })
})
