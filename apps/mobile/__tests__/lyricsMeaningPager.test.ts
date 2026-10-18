import { describe, expect, it } from "vitest"

import {
  lyricsMeaningModeFromGesture,
  lyricsMeaningOffset,
} from "@/lib/lyricsMeaningPager"

describe("lyricsMeaningPager", () => {
  it("keeps lyrics at offset 0 and meaning one page left", () => {
    expect(lyricsMeaningOffset("lyrics", 320)).toBe(0)
    expect(lyricsMeaningOffset("meaning", 320)).toBe(-320)
  })

  it("snaps to meaning after a left swipe past the midpoint", () => {
    expect(lyricsMeaningModeFromGesture(-200, 320, 0)).toBe("meaning")
    expect(lyricsMeaningModeFromGesture(-40, 320, 0)).toBe("lyrics")
    expect(lyricsMeaningModeFromGesture(-40, 320, -1800)).toBe("meaning")
  })
})
