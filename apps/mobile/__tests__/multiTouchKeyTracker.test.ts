import { describe, expect, it } from "vitest"

import { createMultiTouchKeyTracker } from "@/lib/multiTouchKeyTracker"

describe("multiTouchKeyTracker", () => {
  it("fires press once and release once per key across multiple fingers", () => {
    const tracker = createMultiTouchKeyTracker()
    expect(tracker.touchDown(1, 5)).toBe(true)
    expect(tracker.touchDown(2, 7)).toBe(true)
    expect(tracker.touchDown(3, 5)).toBe(false)

    expect(tracker.touchUp(1)).toEqual({ keyIndex: 5, lastOnKey: false })
    expect(tracker.touchUp(3)).toEqual({ keyIndex: 5, lastOnKey: true })
    expect(tracker.touchUp(2)).toEqual({ keyIndex: 7, lastOnKey: true })
    expect(tracker.touchUp(9)).toBeNull()
  })

  it("clears all touch state on reset", () => {
    const tracker = createMultiTouchKeyTracker()
    tracker.touchDown(1, 2)
    tracker.reset()
    expect(tracker.touchUp(1)).toBeNull()
  })

  it("moves a finger across keys for glissando", () => {
    const tracker = createMultiTouchKeyTracker()
    expect(tracker.touchDown(1, 2)).toBe(true)
    expect(tracker.touchMove(1, 5)).toEqual({
      releasedKey: 2,
      releasedLast: true,
      pressedKey: 5,
      pressedFirst: true,
    })
    expect(tracker.touchUp(1)).toEqual({ keyIndex: 5, lastOnKey: true })
  })
})
