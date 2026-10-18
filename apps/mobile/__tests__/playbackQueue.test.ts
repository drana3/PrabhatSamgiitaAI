import { describe, expect, it } from "vitest"

import {
  nextQueueNumber,
  listenQueueForSong,
  playbackAdvanceQueue,
  playlistStep,
  randomSongNumber,
  resolvePlaybackMode,
  shouldAdvanceAfterTrackEnd,
} from "@/lib/playbackQueue"

describe("playlist and drive queues", () => {
  it("advances inside a playlist and stops at the ends", () => {
    expect(playlistStep(2, [1, 2, 3], 1)).toBe(3)
    expect(playlistStep(3, [1, 2, 3], 1)).toBeNull()
    expect(playlistStep(1, [1, 2, 3], -1)).toBeNull()
    expect(playlistStep(2, [1, 2, 3], -1)).toBe(1)
  })

  it("keeps the active playlist on the song page", () => {
    expect(listenQueueForSong(5, [9, 10], "playlist", [3, 5, 7])).toEqual([3, 5, 7])
    expect(listenQueueForSong(5, [9, 10], "default", [3, 5, 7])).toEqual([5, 9, 10])
    expect(listenQueueForSong(30, [9, 10], "playlist", [30, 9, 10], [10, 20, 30])).toEqual([
      10,
      20,
      30,
    ])
  })

  it("keeps default mode unless playback mode is explicit", () => {
    expect(resolvePlaybackMode([1, 2, 3])).toBe("default")
    expect(resolvePlaybackMode([1])).toBe("default")
    expect(resolvePlaybackMode([1, 2], "random")).toBe("random")
    expect(resolvePlaybackMode([1, 2], "playlist")).toBe("playlist")
  })

  it("knows when to auto-advance", () => {
    expect(shouldAdvanceAfterTrackEnd("playlist", 2, [1, 2, 3])).toBe(true)
    expect(shouldAdvanceAfterTrackEnd("playlist", 3, [1, 2, 3])).toBe(false)
    expect(shouldAdvanceAfterTrackEnd("random", 4, [])).toBe(true)
    expect(shouldAdvanceAfterTrackEnd("default", 1, [1, 2])).toBe(false)
    expect(shouldAdvanceAfterTrackEnd("default", 2, [1, 2])).toBe(false)
  })

  it("picks the next queue number without skipping past the end", () => {
    expect(nextQueueNumber("playlist", 2, [1, 2, 3])).toBe(3)
    expect(nextQueueNumber("playlist", 3, [1, 2, 3])).toBeNull()
    expect(nextQueueNumber("playlist", 1, [1, 10, 2])).toBe(2)
    expect(nextQueueNumber("default", 1, [1, 2, 3])).toBe(2)
    expect(nextQueueNumber("default", 3, [1, 2, 3])).toBeNull()
  })

  it("prefers bounded playlist order over related-song queues", () => {
    expect(playbackAdvanceQueue("playlist", [10, 20, 30], [30, 99, 100])).toEqual([10, 20, 30])
    expect(shouldAdvanceAfterTrackEnd("playlist", 30, [10, 20, 30])).toBe(false)
    expect(shouldAdvanceAfterTrackEnd("playlist", 30, [30, 99, 100])).toBe(true)
  })

  it("stops random auto-advance in default playback mode", () => {
    expect(shouldAdvanceAfterTrackEnd("default", 42, [])).toBe(false)
  })

  it("does not immediately repeat the same random song", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(randomSongNumber(4)).not.toBe(4)
    }
  })
})
