import { describe, expect, it } from "vitest"

import { waveformHeights } from "@/lib/playerV2/waveform"

describe("waveformHeights", () => {
  it("gives 56 bars between 12 and 100 percent", () => {
    const bars = waveformHeights(3)
    expect(bars).toHaveLength(56)
    expect(Math.min(...bars)).toBeGreaterThanOrEqual(12)
    expect(Math.max(...bars)).toBeLessThanOrEqual(100)
  })

  it("is the same for the same song and different for another", () => {
    expect(waveformHeights(7)).toEqual(waveformHeights(7))
    expect(waveformHeights(7)).not.toEqual(waveformHeights(8))
  })

  it("matches the prototype's first bars for PS 3", () => {
    // Computed with the prototype formula (Main.dc.html, `bars`) for cur.n = 3.
    expect(waveformHeights(3).slice(0, 3)).toEqual([24, 55, 33])
  })
})
