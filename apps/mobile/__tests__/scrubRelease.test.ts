import { describe, expect, it } from "vitest"

import { shouldSeekOnRelease } from "@/lib/playerV2/gesture"

describe("scrub bar release", () => {
  it("a plain tap (never became a drag) seeks", () => {
    expect(shouldSeekOnRelease({ activated: false, success: false, touchesCancelled: false })).toBe(true)
  })
  it("a finished drag seeks", () => {
    expect(shouldSeekOnRelease({ activated: true, success: true, touchesCancelled: false })).toBe(true)
  })
  it("a drag cancelled by the system or another gesture does not seek", () => {
    expect(shouldSeekOnRelease({ activated: true, success: false, touchesCancelled: false })).toBe(false)
    expect(shouldSeekOnRelease({ activated: false, success: false, touchesCancelled: true })).toBe(false)
  })
})
