import { describe, expect, it } from "vitest"

import {
  isActivePlaylistSong,
  isPlaylistUnderPlay,
  playlistNowPlayingRowMeta,
  playlistPlaybackSubtitle,
  playlistPosition,
  playlistQueueForPlayback,
} from "@/lib/playlistPlayback"

describe("playlistPlayback", () => {
  it("formats subtitle with name and position", () => {
    expect(
      playlistPlaybackSubtitle("playlist", [10, 20, 30], 20, { id: "p1", name: "Morning" }),
    ).toBe("Morning · 2 of 3")
  })

  it("returns position index", () => {
    expect(playlistPosition([5, 6, 7], 7)).toEqual({ index: 2, total: 3 })
  })

  it("detects active playlist songs", () => {
    expect(isActivePlaylistSong("playlist", [1, 2], 2)).toBe(true)
    expect(isActivePlaylistSong("default", [1, 2], 2)).toBe(false)
  })

  it("prefers playlist bounds over incidental queue numbers", () => {
    expect(playlistQueueForPlayback("playlist", [10, 20], [99, 10])).toEqual([10, 20])
    expect(playlistQueueForPlayback("default", [10, 20], [5, 6])).toEqual([5, 6])
  })

  it("marks playlist under play in list rows", () => {
    expect(isPlaylistUnderPlay("playlist", "p1", "p1")).toBe(true)
    expect(isPlaylistUnderPlay("playlist", "p1", "p2")).toBe(false)
    expect(
      playlistNowPlayingRowMeta("playlist", "p1", "p1", [10, 20], 20),
    ).toBe("Playing now · 2 of 2")
  })
})
