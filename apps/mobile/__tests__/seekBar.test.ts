import { describe, expect, it } from "vitest"

import { seekSecondsFromTouch } from "@/lib/seekBar"

describe("seekSecondsFromTouch", () => {
  it("maps the left edge, midpoint, and right edge", () => {
    expect(seekSecondsFromTouch(0, 100, 200)).toBe(0)
    expect(seekSecondsFromTouch(50, 100, 200)).toBe(100)
    expect(seekSecondsFromTouch(100, 100, 200)).toBe(200)
  })

  it("clamps drags past the bar", () => {
    expect(seekSecondsFromTouch(-40, 100, 80)).toBe(0)
    expect(seekSecondsFromTouch(180, 100, 80)).toBe(80)
  })
})

