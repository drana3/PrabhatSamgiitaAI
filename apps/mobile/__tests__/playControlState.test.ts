import { describe, expect, it } from "vitest"

import { playControlState } from "@/lib/playback"

describe("playControlState (BUG-27)", () => {
  it("shows a spinner while loading or buffering, even when playback is intended", () => {
    expect(playControlState({ isPlaying: true, isBuffering: true })).toBe("loading")
    expect(playControlState({ isPlaying: false, isBuffering: true })).toBe("loading")
  })

  it("shows pause only when audio is actually playing", () => {
    expect(playControlState({ isPlaying: true, isBuffering: false })).toBe("pause")
  })

  it("shows play when idle", () => {
    expect(playControlState({ isPlaying: false, isBuffering: false })).toBe("play")
  })
})
