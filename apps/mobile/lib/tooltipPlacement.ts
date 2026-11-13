/**
 * Where a small hint bubble goes next to the thing it explains. Pure, no React: components/common/HintBubble.tsx
 * measures the screen and hands the rectangles in, this decides.
 *
 * The rule (Dada): a hint never covers a control. So the bubble is tried below the icon, above it, to the right and to
 * the left, in that order, and the first spot that is fully inside the screen AND touches none of the `avoid`
 * rectangles (the rows of buttons around the icon) wins. Along the edge it sits on, the bubble is slid back inside the
 * screen margins, and its little arrow keeps pointing at the icon. If no spot is free, the answer is null and the
 * caller shows no bubble at all: no hint is better than a hint on top of Play.
 */

export type Rect = { x: number; y: number; width: number; height: number }
export type Size = { width: number; height: number }
export type TooltipSide = "below" | "above" | "right" | "left"

export type TooltipPlacement = {
  side: TooltipSide
  /** window coordinates of the bubble's top-left corner */
  left: number
  top: number
  /** where the arrow's centre sits along the bubble edge it is on: from the bubble's left (below/above) or top (right/left) */
  arrow: number
}

export type PlaceInput = {
  anchor: Rect
  /** the bubble body, arrow not included (the arrow lives in `gap`) */
  size: Size
  /** the screen area a bubble may use (e.g. the window without the status bar) */
  bounds: Rect
  /** controls the bubble must not touch */
  avoid?: readonly Rect[]
  /** space between the anchor and the bubble: holds the arrow */
  gap?: number
  /** least distance to the left and right edges of `bounds` */
  margin?: number
  /** the arrow stays this far from the bubble's corners */
  arrowInset?: number
  order?: readonly TooltipSide[]
}

export const TOOLTIP_ORDER: readonly TooltipSide[] = ["below", "above", "right", "left"]

const clamp = (value: number, low: number, high: number) => (high < low ? low : Math.min(Math.max(value, low), high))

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function inside(inner: Rect, outer: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height
}

/** The bubble's rectangle on one side of the anchor, slid along that side to stay inside the margins. */
function candidate(side: TooltipSide, input: PlaceInput, gap: number, margin: number): Rect & { arrow: number } {
  const { anchor, size, bounds } = input
  const arrowInset = input.arrowInset ?? 14
  const centreX = anchor.x + anchor.width / 2
  const centreY = anchor.y + anchor.height / 2
  if (side === "below" || side === "above") {
    const left = clamp(centreX - size.width / 2, bounds.x + margin, bounds.x + bounds.width - margin - size.width)
    const top = side === "below" ? anchor.y + anchor.height + gap : anchor.y - gap - size.height
    return { x: left, y: top, width: size.width, height: size.height, arrow: clamp(centreX - left, arrowInset, size.width - arrowInset) }
  }
  const top = clamp(centreY - size.height / 2, bounds.y, bounds.y + bounds.height - size.height)
  const left = side === "right" ? anchor.x + anchor.width + gap : anchor.x - gap - size.width
  return { x: left, y: top, width: size.width, height: size.height, arrow: clamp(centreY - top, arrowInset, size.height - arrowInset) }
}

/** The first free spot, or null when every side is blocked or off screen. */
export function placeTooltip(input: PlaceInput): TooltipPlacement | null {
  const gap = input.gap ?? 8
  const margin = input.margin ?? 8
  const avoid = input.avoid ?? []
  const safe: Rect = { x: input.bounds.x + margin, y: input.bounds.y, width: input.bounds.width - 2 * margin, height: input.bounds.height }
  for (const side of input.order ?? TOOLTIP_ORDER) {
    const spot = candidate(side, input, gap, margin)
    if (input.size.width > safe.width) continue
    if (!inside(spot, safe)) continue
    if (avoid.some((rect) => rectsOverlap(spot, rect))) continue
    return { side, left: spot.x, top: spot.y, arrow: spot.arrow }
  }
  return null
}
