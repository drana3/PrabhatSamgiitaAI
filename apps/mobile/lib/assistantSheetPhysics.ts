/** Same maths as projectMomentum in amMotion, repeated here so it can run as a worklet. */
function project(x: number, velocity: number): number {
  "worklet"
  return x + (velocity / 1000) * (0.998 / (1 - 0.998))
}

/**
 * Bottom-sheet gesture maths (spec section 1, Motion). Pure, so the feel of the
 * drag can be tested without a device.
 */

/** Apple-style rubber band: resistance grows as the finger goes past the limit. */
export function rubberBand(offset: number, dimension: number, coefficient = 0.55): number {
  "worklet"
  if (offset <= 0 || dimension <= 0) return 0
  return (1 - 1 / ((offset * coefficient) / dimension + 1)) * dimension
}

/**
 * Where the sheet sits for a raw finger offset. Downwards follows the finger
 * one to one; upwards (past fully open) is rubber-banded.
 */
export function sheetOffset(rawTranslation: number, height: number): number {
  "worklet"
  if (rawTranslation >= 0) return rawTranslation
  return -rubberBand(-rawTranslation, height)
}

export type SheetSettle = { dismiss: boolean; target: number; landing: number }

/**
 * On release: project where inertia would carry the sheet, and dismiss when
 * that lands past the halfway line. A fast downward flick dismisses even from
 * near the top; a fast upward flick keeps the sheet open even when dragged low.
 */
export function settleSheet(input: {
  translation: number
  /** dp per second, positive = downwards */
  velocity: number
  height: number
}): SheetSettle {
  "worklet"
  const landing = project(Math.max(input.translation, 0), input.velocity)
  const dismiss = landing > input.height * 0.5
  return { dismiss, target: dismiss ? input.height : 0, landing }
}

/** Backdrop opacity follows the sheet's live position, so it is interruptible too. */
export function backdropOpacity(translateY: number, height: number, max = 0.4): number {
  "worklet"
  if (height <= 0) return 0
  const progress = 1 - Math.min(Math.max(translateY / height, 0), 1)
  return progress * max
}

/** True when the reader is at, or close to, the end of a scrolling thread. */
export function isNearBottom(input: {
  offsetY: number
  viewportHeight: number
  contentHeight: number
  threshold?: number
}): boolean {
  const { offsetY, viewportHeight, contentHeight, threshold = 120 } = input
  return contentHeight - (offsetY + viewportHeight) <= threshold
}
