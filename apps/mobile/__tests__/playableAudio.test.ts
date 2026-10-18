import { describe, expect, it } from "vitest"

import {
  hasPlayableAudio,
  nextPlayableInQueue,
  playableAudioCount,
  randomPlayableSongNumber,
} from "@/lib/playableAudio"

describe("playableAudio corpus", () => {
  it("knows which PS numbers have official audio", () => {
    expect(hasPlayableAudio(1)).toBe(true)
    expect(hasPlayableAudio(10)).toBe(false)
    expect(playableAudioCount()).toBeGreaterThan(3500)
  })

  it("picks another playable song for random mode", () => {
    for (let i = 0; i < 24; i += 1) {
      const next = randomPlayableSongNumber(1)
      expect(next).not.toBe(1)
      expect(hasPlayableAudio(next)).toBe(true)
    }
  })

  it("skips unplayable entries when walking a playlist queue", () => {
    const queue = [1000, 10, 1001]
    expect(nextPlayableInQueue(queue, 1000, 1)).toBe(1001)
    expect(nextPlayableInQueue(queue, 1001, -1)).toBe(1000)
    expect(nextPlayableInQueue(queue, 10, 1)).toBe(1001)
  })
})
