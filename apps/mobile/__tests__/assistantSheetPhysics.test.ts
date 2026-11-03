import { describe, expect, it } from "vitest"

import { projectMomentum } from "@/constants/tokens/amMotion"
import { backdropOpacity, rubberBand, settleSheet, sheetOffset } from "@/lib/assistantSheetPhysics"

describe("sheet physics", () => {
  it("rubber band grows slower than the finger and never reaches the dimension", () => {
    expect(rubberBand(0, 600)).toBe(0)
    const a = rubberBand(100, 600)
    const b = rubberBand(200, 600)
    expect(a).toBeGreaterThan(0)
    expect(a).toBeLessThan(100)
    expect(b).toBeGreaterThan(a)
    expect(b - a).toBeLessThan(a)
    expect(rubberBand(1_000_000, 600)).toBeLessThan(600)
  })

  it("follows the finger one to one downwards and resists upwards", () => {
    expect(sheetOffset(120, 600)).toBe(120)
    const up = sheetOffset(-100, 600)
    expect(up).toBeLessThan(0)
    expect(up).toBeGreaterThan(-100)
  })

  it("settles open after a small slow drag", () => {
    const result = settleSheet({ translation: 40, velocity: 50, height: 600 })
    expect(result.dismiss).toBe(false)
    expect(result.target).toBe(0)
  })

  it("dismisses when inertia would carry it past halfway, even from a short drag", () => {
    const result = settleSheet({ translation: 40, velocity: 2000, height: 600 })
    expect(result.landing).toBeCloseTo(projectMomentum(40, 2000))
    expect(result.dismiss).toBe(true)
    expect(result.target).toBe(600)
  })

  it("an upward flick keeps a low sheet open", () => {
    expect(settleSheet({ translation: 400, velocity: -3000, height: 600 }).dismiss).toBe(false)
  })

  it("backdrop fades with the sheet position", () => {
    expect(backdropOpacity(0, 600)).toBeCloseTo(0.4)
    expect(backdropOpacity(600, 600)).toBe(0)
    expect(backdropOpacity(300, 600)).toBeCloseTo(0.2)
    expect(backdropOpacity(900, 600)).toBe(0)
    expect(backdropOpacity(10, 0)).toBe(0)
  })
})

import { isNearBottom } from "@/lib/assistantSheetPhysics"

describe("thread follow", () => {
  it("follows the answer while the reader is at the end, lets go when they scroll up", () => {
    expect(isNearBottom({ offsetY: 900, viewportHeight: 600, contentHeight: 1560 })).toBe(true)
    expect(isNearBottom({ offsetY: 200, viewportHeight: 600, contentHeight: 1560 })).toBe(false)
    expect(isNearBottom({ offsetY: 0, viewportHeight: 600, contentHeight: 400 })).toBe(true)
  })
})
