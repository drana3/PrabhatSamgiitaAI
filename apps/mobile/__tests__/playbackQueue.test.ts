import { describe, expect, it } from "vitest"

import { playlistStep, randomSongNumber } from "@/lib/playbackQueue"

describe("playlist and drive queues", () => {
  it("advances inside a playlist and stops at the ends", () => {
    expect(playlistStep(2, [1, 2, 3], 1)).toBe(3)
    expect(playlistStep(3, [1, 2, 3], 1)).toBeNull()
    expect(playlistStep(1, [1, 2, 3], -1)).toBeNull()
    expect(playlistStep(2, [1, 2, 3], -1)).toBe(1)
  })

  it("does not immediately repeat the same random song", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(randomSongNumber(4)).not.toBe(4)
    }
  })
})
