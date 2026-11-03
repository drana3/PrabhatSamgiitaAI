import { describe, expect, it } from "vitest"

import { projectMomentum } from "@/constants/tokens/amMotion"
import {
  FLING_VELOCITY,
  rubberBand,
  scrimOpacity,
  settleSheet,
  sheetHeight,
  sheetPositionDuringDrag,
} from "@/lib/sheetPhysics"

describe("sheet physics: rubber band", () => {
  it("is zero at the edge, grows, and never reaches the dimension", () => {
    expect(rubberBand(0, 800)).toBe(0)
    expect(rubberBand(-20, 800)).toBe(0)
    const a = rubberBand(50, 800)
    const b = rubberBand(500, 800)
    const c = rubberBand(50_000, 800)
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(a)
    expect(b).toBeLessThan(500)
    expect(c).toBeLessThan(800)
  })

  it("starts close to the finger for small pulls", () => {
    expect(rubberBand(10, 800)).toBeGreaterThan(5)
    expect(rubberBand(10, 800)).toBeLessThan(10)
  })
})

describe("sheet physics: drag", () => {
  it("follows the finger 1:1 downwards from the grab point", () => {
    expect(sheetPositionDuringDrag(0, 120, 700)).toBe(120)
    // grabbed mid-animation at 200: the sheet stays under the finger
    expect(sheetPositionDuringDrag(200, 35, 700)).toBe(235)
  })

  it("resists upward pulls and clamps at hidden", () => {
    const up = sheetPositionDuringDrag(0, -100, 700)
    expect(up).toBeLessThan(0)
    expect(up).toBeGreaterThan(-100)
    expect(sheetPositionDuringDrag(600, 400, 700)).toBe(700)
  })
})

describe("sheet physics: settle", () => {
  const height = 700

  it("returns a slow short drag to open", () => {
    const r = settleSheet({ y: 120, velocity: 0, height })
    expect(r.dismiss).toBe(false)
    expect(r.target).toBe(0)
    expect(r.spring).toBe("default")
  })

  it("dismisses a slow drag past half", () => {
    const r = settleSheet({ y: 420, velocity: 20, height })
    expect(r.dismiss).toBe(true)
    expect(r.target).toBe(height)
  })

  it("dismisses a short fast flick down by momentum projection", () => {
    const r = settleSheet({ y: 60, velocity: 1400, height })
    expect(r.projected).toBeCloseTo(projectMomentum(60, 1400))
    expect(r.dismiss).toBe(true)
    expect(r.spring).toBe("fling")
  })

  it("returns a far drag to open when flung back up", () => {
    const r = settleSheet({ y: 400, velocity: -1500, height })
    expect(r.dismiss).toBe(false)
    expect(r.target).toBe(0)
    expect(r.spring).toBe("fling")
  })

  it("uses the critically damped spring below fling speed", () => {
    expect(settleSheet({ y: 100, velocity: FLING_VELOCITY - 1, height }).spring).toBe("default")
  })
})

describe("sheet physics: scrim and height", () => {
  it("scrim tracks the sheet", () => {
    expect(scrimOpacity(0, 700)).toBeCloseTo(0.45)
    expect(scrimOpacity(700, 700)).toBe(0)
    expect(scrimOpacity(350, 700)).toBeCloseTo(0.225)
    expect(scrimOpacity(-40, 700)).toBeCloseTo(0.45)
    expect(scrimOpacity(0, 0)).toBe(0)
  })

  it("leaves a strip of the screen visible above the sheet", () => {
    expect(sheetHeight(844, 47)).toBe(844 - 59)
    expect(sheetHeight(844, 0)).toBe(844 - 36)
    expect(sheetHeight(300, 0)).toBe(320)
  })
})
