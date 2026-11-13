import { describe, expect, it } from "vitest"

import { OPTION_ROW_HEIGHT, POPOVER_EDGE, POPOVER_GAP, POPOVER_MIN, estimateCardHeight, placePopover } from "@/lib/songPage/optionsPlacement"

const base = { anchorHeight: 44, windowHeight: 844, topInset: 64 }

describe("the Aa window placement", () => {
  it("hangs under the button when the card fits below", () => {
    const p = placePopover({ ...base, anchorBottom: 200, cardHeight: estimateCardHeight(4) })
    expect(p.placement).toBe("below")
    expect(p.top).toBe(200 + POPOVER_GAP)
    expect(p.bottom).toBeNull()
  })

  it("opens upwards from a button that is low on the screen, instead of being cut off", () => {
    const p = placePopover({ ...base, anchorBottom: 560, cardHeight: estimateCardHeight(4) })
    expect(p.placement).toBe("above")
    expect(p.top).toBeNull()
    // the card's bottom edge sits one gap above the button's top edge
    expect(base.windowHeight - (p.bottom ?? 0)).toBe(560 - base.anchorHeight - POPOVER_GAP)
    expect(p.maxHeight).toBeGreaterThanOrEqual(estimateCardHeight(4))
  })

  it("takes the larger side and scrolls when neither side has room", () => {
    const p = placePopover({ anchorBottom: 300, anchorHeight: 44, windowHeight: 520, topInset: 64, cardHeight: 900 })
    expect(p.maxHeight).toBeGreaterThanOrEqual(POPOVER_MIN)
    expect(["below", "above"]).toContain(p.placement)
  })

  it("never leaves less than the edge air under a card hung below", () => {
    const p = placePopover({ ...base, anchorBottom: 400, cardHeight: estimateCardHeight(5) })
    expect(p.placement).toBe("below")
    expect((p.top ?? 0) + estimateCardHeight(5)).toBeLessThanOrEqual(base.windowHeight - POPOVER_EDGE)
  })

  it("makes every row the same height, a hint row a little taller", () => {
    expect(estimateCardHeight(5)).toBeGreaterThan(5 * OPTION_ROW_HEIGHT)
    expect(estimateCardHeight(4, 1)).toBeGreaterThan(estimateCardHeight(4))
  })
})
