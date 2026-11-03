import { describe, expect, it } from "vitest"

import { playControlState } from "@/lib/playback"
import { formatKnownDuration } from "@/utils/formatDuration"

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

describe("formatKnownDuration (BUG-27)", () => {
  it("hides an unknown duration instead of printing 0:00 or a placeholder", () => {
    expect(formatKnownDuration(0)).toBe("–:–")
    expect(formatKnownDuration(Number.NaN)).toBe("–:–")
    expect(formatKnownDuration(-3)).toBe("–:–")
  })

  it("formats a known duration", () => {
    expect(formatKnownDuration(187)).toBe("3:07")
  })
})
