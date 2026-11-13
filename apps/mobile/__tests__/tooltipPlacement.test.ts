import { describe, expect, it } from "vitest"

import { placeTooltip, rectsOverlap, type Rect } from "@/lib/tooltipPlacement"

const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height })

/** The player's lower part at 390x844: transport row, then the row of icons with the "i" last, then 40 of empty ground. */
const PLAYER_390 = {
  bounds: rect(0, 0, 390, 842),
  anchor: rect(301, 756, 48, 48),
  avoid: [rect(24, 690, 342, 52), rect(24, 756, 342, 48)],
  size: { width: 240, height: 29 },
  gap: 7,
}

describe("placeTooltip", () => {
  it("goes below the icon when the room under the row is free", () => {
    const spot = placeTooltip(PLAYER_390)!
    expect(spot.side).toBe("below")
    expect(spot.top).toBe(756 + 48 + 7)
  })

  it("is slid back inside the screen margin, and the arrow still points at the icon", () => {
    const spot = placeTooltip(PLAYER_390)!
    expect(spot.left + 240).toBe(390 - 8)
    expect(spot.left + spot.arrow).toBeCloseTo(325, 5)
  })

  it("never lands on a control: left and above the icon are the buttons, so it picks the free side or none", () => {
    const spot = placeTooltip({ ...PLAYER_390, bounds: rect(0, 0, 390, 700) })
    expect(spot).toBeNull()
  })

  it("flips above when there is no room below but the space above is free", () => {
    const spot = placeTooltip({ ...PLAYER_390, bounds: rect(0, 0, 390, 820), avoid: [], size: { width: 240, height: 40 } })!
    expect(spot.side).toBe("above")
    expect(spot.top + 40 + 7).toBe(756)
  })

  it("tries the right side when the icon is on the left and the sides above and below are blocked", () => {
    const spot = placeTooltip({
      anchor: rect(10, 400, 48, 48),
      size: { width: 200, height: 30 },
      bounds: rect(0, 0, 390, 800),
      avoid: [rect(0, 300, 390, 90), rect(0, 460, 390, 90)],
      gap: 7,
    })!
    expect(spot.side).toBe("right")
    expect(spot.left).toBe(10 + 48 + 7)
    expect(spot.top).toBe(400 + 24 - 15)
  })

  it("is null when the bubble is wider than the screen allows", () => {
    expect(placeTooltip({ ...PLAYER_390, size: { width: 380, height: 29 } })).toBeNull()
  })

  it("is null when the bubble would run off the bottom edge", () => {
    expect(placeTooltip({ ...PLAYER_390, bounds: rect(0, 0, 390, 820) })).toBeNull()
  })

  it("keeps the arrow off the bubble's corners", () => {
    const spot = placeTooltip({ anchor: rect(0, 100, 20, 20), size: { width: 160, height: 30 }, bounds: rect(0, 0, 390, 800), gap: 7, arrowInset: 14 })!
    expect(spot.left).toBe(8)
    expect(spot.arrow).toBe(14)
  })

  it("honours a custom order", () => {
    const spot = placeTooltip({ anchor: rect(150, 400, 48, 48), size: { width: 120, height: 30 }, bounds: rect(0, 0, 390, 800), order: ["above", "below"] })!
    expect(spot.side).toBe("above")
  })

  it("holds at the narrow 360 width: below the icon, inside both margins", () => {
    const spot = placeTooltip({ ...PLAYER_390, bounds: rect(0, 0, 360, 842), anchor: rect(271, 756, 48, 48), avoid: [rect(24, 690, 312, 52), rect(24, 756, 312, 48)] })!
    expect(spot.side).toBe("below")
    expect(spot.left).toBeGreaterThanOrEqual(8)
    expect(spot.left + 240).toBeLessThanOrEqual(360 - 8)
  })
})

describe("rectsOverlap", () => {
  it("is false for rectangles that only share an edge", () => {
    expect(rectsOverlap(rect(0, 0, 10, 10), rect(10, 0, 10, 10))).toBe(false)
  })
  it("is true for rectangles that cross", () => {
    expect(rectsOverlap(rect(0, 0, 10, 10), rect(9, 9, 10, 10))).toBe(true)
  })
})
