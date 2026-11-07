import { describe, expect, it } from "vitest"

import {
  MAX_ZOOM,
  clampOffset,
  clampScale,
  clampState,
  cropRect,
  defaultCrop,
  isDefaultCrop,
  maxScale,
  minScale,
  offsetLimits,
  projectOffset,
  rubberBand,
  softOffset,
  softScale,
  windowDiameter,
  zoomAround,
  zoomTo,
} from "@/lib/profile/crop"

const D = 300
const portrait = { width: 1200, height: 1800 }
const landscape = { width: 2000, height: 1000 }
const square = { width: 800, height: 800 }

describe("crop: scale limits", () => {
  it("the smallest scale makes the short side exactly fill the window", () => {
    expect(minScale(portrait, D)).toBeCloseTo(0.25)
    expect(minScale(landscape, D)).toBeCloseTo(0.3)
  })

  it("the largest scale is MAX_ZOOM times the smallest", () => {
    expect(maxScale(portrait, D)).toBeCloseTo(0.25 * MAX_ZOOM)
  })

  it("clampScale keeps the window covered and the zoom bounded", () => {
    expect(clampScale(0.01, portrait, D)).toBeCloseTo(0.25)
    expect(clampScale(50, portrait, D)).toBeCloseTo(0.25 * MAX_ZOOM)
    expect(clampScale(0.5, portrait, D)).toBe(0.5)
  })

  it("a picture smaller than the window is scaled up to cover it, never left short", () => {
    const tiny = { width: 100, height: 150 }
    expect(minScale(tiny, D)).toBeCloseTo(3)
  })
})

describe("crop: the window is always covered", () => {
  it("the limits are half of what overhangs the window", () => {
    const lim = offsetLimits(portrait, D, 0.25)
    expect(lim.x).toBeCloseTo(0)
    expect(lim.y).toBeCloseTo((1800 * 0.25 - 300) / 2)
  })

  it("no overhang means no room to move on that axis", () => {
    expect(offsetLimits(square, D, minScale(square, D))).toEqual({ x: 0, y: 0 })
  })

  it("clampOffset stops at the limit on both sides", () => {
    expect(clampOffset(500, 75)).toBe(75)
    expect(clampOffset(-500, 75)).toBe(-75)
    expect(clampOffset(20, 75)).toBe(20)
  })

  it("clampState fixes a scale and an offset that uncover the window", () => {
    const fixed = clampState({ scale: 0.1, x: 999, y: -999 }, portrait, D)
    expect(fixed.scale).toBeCloseTo(0.25)
    expect(fixed.x).toBeCloseTo(0)
    expect(fixed.y).toBeCloseTo(-75)
  })

  it("after clamping, the picture edges are never inside the window", () => {
    for (const image of [portrait, landscape, square]) {
      for (const scale of [0.1, 0.3, 0.9, 5]) {
        const s = clampState({ scale, x: 1e6, y: -1e6 }, image, D)
        expect(image.width * s.scale / 2 - Math.abs(s.x)).toBeGreaterThanOrEqual(D / 2 - 1e-6)
        expect(image.height * s.scale / 2 - Math.abs(s.y)).toBeGreaterThanOrEqual(D / 2 - 1e-6)
      }
    }
  })
})

describe("crop: rubber band", () => {
  it("is nothing at no distance and starts at about half the finger distance (slope 0.55)", () => {
    expect(rubberBand(0, 300)).toBe(0)
    expect(rubberBand(1, 300)).toBeCloseTo(0.55, 1)
    expect(rubberBand(-5, 300)).toBe(0)
  })

  it("grows with the distance but never passes the dimension", () => {
    const a = rubberBand(50, 300)
    const b = rubberBand(500, 300)
    expect(b).toBeGreaterThan(a)
    expect(b).toBeLessThan(300)
    expect(rubberBand(1e9, 300)).toBeLessThanOrEqual(300)
  })

  it("softOffset leaves the inside alone and resists beyond either limit", () => {
    expect(softOffset(30, 75, 300)).toBe(30)
    const over = softOffset(175, 75, 300)
    expect(over).toBeGreaterThan(75)
    expect(over).toBeLessThan(175)
    expect(softOffset(-175, 75, 300)).toBeCloseTo(-over)
  })

  it("softScale resists below the smallest and above the largest scale", () => {
    const low = minScale(portrait, D)
    const high = maxScale(portrait, D)
    expect(softScale(low * 1.5, portrait, D)).toBeCloseTo(low * 1.5)
    const under = softScale(low * 0.5, portrait, D)
    expect(under).toBeLessThan(low)
    expect(under).toBeGreaterThan(low * 0.5)
    const above = softScale(high * 2, portrait, D)
    expect(above).toBeGreaterThan(high)
    expect(above).toBeLessThan(high * 2)
  })
})

describe("crop: the opening state", () => {
  it("is centred for a landscape picture, at the smallest scale", () => {
    const s = defaultCrop(landscape, D)
    expect(s.scale).toBeCloseTo(0.3)
    expect(s.x).toBeCloseTo(0)
    expect(s.y).toBeCloseTo(0)
  })

  it("is centred for a square picture", () => {
    expect(defaultCrop(square, D)).toEqual({ scale: minScale(square, D), x: 0, y: 0 })
  })

  it("puts the window high in a portrait picture, where faces are", () => {
    const s = defaultCrop(portrait, D)
    const rect = cropRect(s, portrait, D)
    // 1200x1800 at 0.25: the window is 1200 px tall in the picture; a centre at the upper third is clamped to the top
    expect(rect.originX).toBe(0)
    expect(rect.originY).toBe(0)
    expect(rect.width).toBe(1200)
  })

  it("a tall picture puts the window centre at one third when there is room", () => {
    const tall = { width: 1000, height: 4000 }
    const s = defaultCrop(tall, D)
    const rect = cropRect(s, tall, D)
    const centerY = rect.originY + rect.height / 2
    expect(centerY / tall.height).toBeCloseTo(1 / 3, 1)
  })

  it("isDefaultCrop says when there is nothing to reset", () => {
    const s = defaultCrop(portrait, D)
    expect(isDefaultCrop(s, portrait, D)).toBe(true)
    expect(isDefaultCrop({ ...s, scale: s.scale * 1.2 }, portrait, D)).toBe(false)
    expect(isDefaultCrop({ ...s, y: s.y + 3 }, portrait, D)).toBe(false)
  })
})

describe("crop: zoom holds the point under the finger", () => {
  it("zooming around the window centre keeps the offset proportional", () => {
    const next = zoomAround({ scale: 0.5, x: 20, y: -10 }, 1, { x: 0, y: 0 })
    expect(next).toEqual({ scale: 1, x: 40, y: -20 })
  })

  it("the picture pixel under the focal point is the same before and after", () => {
    const state = { scale: 0.5, x: 30, y: -40 }
    const focal = { x: 80, y: 50 }
    const pixelAt = (s: { scale: number; x: number; y: number }) => ({
      u: portrait.width / 2 + (focal.x - s.x) / s.scale,
      v: portrait.height / 2 + (focal.y - s.y) / s.scale,
    })
    const before = pixelAt(state)
    const after = pixelAt(zoomAround(state, 1.1, focal))
    expect(after.u).toBeCloseTo(before.u)
    expect(after.v).toBeCloseTo(before.v)
  })

  it("zoomTo never leaves the window uncovered", () => {
    const s = zoomTo({ scale: 0.5, x: 0, y: 0 }, 0.01, { x: 100, y: 100 }, portrait, D)
    expect(s.scale).toBeCloseTo(0.25)
    const lim = offsetLimits(portrait, D, s.scale)
    expect(Math.abs(s.y)).toBeLessThanOrEqual(lim.y + 1e-9)
  })
})

describe("crop: throw projection", () => {
  it("lands at x + v/1000 * 0.998/(1-0.998)", () => {
    expect(projectOffset(10, 1000)).toBeCloseTo(10 + 499)
    expect(projectOffset(10, -200)).toBeCloseTo(10 - 99.8)
    expect(projectOffset(10, 0)).toBe(10)
  })
})

describe("crop: the rectangle that is cut", () => {
  it("at the smallest scale, a landscape picture gives a centred square of its height", () => {
    const rect = cropRect(defaultCrop(landscape, D), landscape, D)
    expect(rect).toEqual({ originX: 500, originY: 0, width: 1000, height: 1000 })
  })

  it("zoomed to double, the square is half as wide", () => {
    const s = zoomTo(defaultCrop(landscape, D), 0.6, { x: 0, y: 0 }, landscape, D)
    const rect = cropRect(s, landscape, D)
    expect(rect.width).toBe(500)
    expect(rect.height).toBe(500)
    expect(rect.originX).toBe(750)
    expect(rect.originY).toBe(250)
  })

  it("moving the picture left shows the right side of it", () => {
    const base = defaultCrop(landscape, D)
    const lim = offsetLimits(landscape, D, base.scale)
    const rect = cropRect({ ...base, x: -lim.x }, landscape, D)
    expect(rect.originX + rect.width).toBe(landscape.width)
  })

  it("is whole numbers, inside the picture, for any state", () => {
    for (const image of [portrait, landscape, square, { width: 333, height: 777 }]) {
      for (const scale of [0.05, 0.2, 0.6, 1.3, 4]) {
        for (const x of [-1e5, -17.3, 0, 22.9, 1e5]) {
          for (const y of [-1e5, -41.1, 0, 3.3, 1e5]) {
            const r = cropRect({ scale, x, y }, image, D)
            expect(Number.isInteger(r.originX) && Number.isInteger(r.originY) && Number.isInteger(r.width)).toBe(true)
            expect(r.originX).toBeGreaterThanOrEqual(0)
            expect(r.originY).toBeGreaterThanOrEqual(0)
            expect(r.originX + r.width).toBeLessThanOrEqual(image.width)
            expect(r.originY + r.height).toBeLessThanOrEqual(image.height)
            expect(r.width).toBe(r.height)
            expect(r.width).toBeGreaterThanOrEqual(1)
          }
        }
      }
    }
  })

  it("a picture smaller than the window still gives a whole-picture square", () => {
    const tiny = { width: 100, height: 150 }
    const rect = cropRect(defaultCrop(tiny, D), tiny, D)
    expect(rect.width).toBe(100)
    expect(rect.originX).toBe(0)
  })
})

describe("crop: window size", () => {
  it("leaves a margin and is capped", () => {
    expect(windowDiameter(390, 700)).toBe(326)
    expect(windowDiameter(1200, 900)).toBe(360)
    expect(windowDiameter(100, 100)).toBe(120)
  })
})
