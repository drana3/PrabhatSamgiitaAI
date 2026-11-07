/**
 * Every function here is a worklet: the sheet gesture runs on the UI thread.
 * `project` repeats projectMomentum from constants/tokens/amMotion (a test
 * keeps the two equal) because that file is shared and not marked as a worklet.
 */
const DECELERATION = 0.998

export function project(x: number, velocity: number): number {
  "worklet"
  return x + (velocity / 1000) * (DECELERATION / (1 - DECELERATION))
}

/**
 * Pure physics for bottom sheets (spec section 1, motion):
 * 1:1 drag, rubber band at the open edge, momentum projection on release,
 * and a velocity hand-off into the settling spring.
 */

/** Resistance past the edge: the sheet follows the finger at a shrinking ratio. */
export function rubberBand(overshoot: number, limit = 120, coefficient = 0.55): number {
  "worklet"
  if (overshoot <= 0) return 0
  const d = limit
  return (1 - 1 / ((overshoot * coefficient) / d + 1)) * d
}

/**
 * Sheet offset for a drag. `drag` is the finger travel since touch-down
 * (positive = down); `start` is where the sheet was when it was grabbed, so
 * a catch mid-spring never jumps. Pulling up past fully open is rubber-banded.
 */
export function sheetOffsetForDrag(start: number, drag: number): number {
  "worklet"
  const raw = start + drag
  if (raw >= 0) return raw
  return -rubberBand(-raw)
}

export type SheetRelease = {
  /** where the sheet will settle: 0 (open) or the sheet height (closed) */
  target: number
  closes: boolean
  /** where momentum alone would have carried it */
  projected: number
}

/**
 * Decides open or closed on release. The landing point is the projection of
 * the current offset with the finger's velocity, not the distance to an edge:
 * a short fast flick down closes, a slow drag past the middle closes, a slow
 * drag short of it springs back.
 */
export function resolveRelease(input: {
  offset: number
  velocity: number
  height: number
}): SheetRelease {
  "worklet"
  const { offset, velocity, height } = input
  const projected = project(offset, velocity)
  const closes = height > 0 && projected > height / 2
  return { target: closes ? height : 0, closes, projected }
}

/** Initial velocity for the settling spring, sign-aligned with the travel it still has. */
export function springVelocity(velocity: number, offset: number, target: number): number {
  "worklet"
  if (offset === target) return 0
  return velocity
}

/** Scrim opacity follows the sheet: 1 when open, 0 when fully closed. */
export function scrimOpacity(offset: number, height: number, max = 0.4): number {
  "worklet"
  if (!(height > 0)) return 0
  const open = 1 - Math.min(1, Math.max(0, offset / height))
  return open * max
}
