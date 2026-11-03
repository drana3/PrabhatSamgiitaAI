import { projectMomentum } from "@/constants/tokens/amMotion"

/**
 * Pure maths for a bottom sheet. Position `y` is the distance the sheet is
 * pushed down: 0 is fully open, `height` is fully hidden.
 */

/** Past this speed (dp/s) a release counts as a fling and may overshoot a little. */
export const FLING_VELOCITY = 800
/** A sheet that would come to rest below this fraction of its height is dismissed. */
export const DISMISS_FRACTION = 0.5
/** Rubber band stiffness, the same constant UIScrollView uses. */
const RUBBER_CONSTANT = 0.55

/** Resistance past an edge: moves with the finger at first, then gives up. */
export function rubberBand(offset: number, dimension: number, constant = RUBBER_CONSTANT): number {
  "worklet"
  if (offset <= 0 || dimension <= 0) return 0
  return (1 - 1 / ((offset * constant) / dimension + 1)) * dimension
}

/**
 * Position while the finger is down. `startY` is where the sheet was when the
 * drag began (it may be mid-animation), `translation` how far the finger has
 * moved since touch-down. Moves 1:1 downwards, so the grab point stays under
 * the finger; pulling up past open meets a rubber band; never goes below hidden.
 */
export function sheetPositionDuringDrag(startY: number, translation: number, height: number): number {
  "worklet"
  const raw = startY + translation
  if (raw < 0) return -rubberBand(-raw, height)
  return Math.min(raw, height)
}

export type SheetSettle = {
  /** where the sheet comes to rest: 0 open, `height` hidden */
  target: number
  dismiss: boolean
  /** where momentum alone would have carried it */
  projected: number
  /** "fling" allows a small overshoot, "default" is critically damped */
  spring: "default" | "fling"
}

/**
 * Where to send the sheet when the finger lifts. Uses the momentum
 * projection x + (v/1000) * 0.998 / (1 - 0.998), not the distance to an edge,
 * so a short flick down dismisses and a slow drag back up does not.
 */
export function settleSheet(input: {
  y: number
  /** dp/s, positive is downwards */
  velocity: number
  height: number
  dismissFraction?: number
}): SheetSettle {
  "worklet"
  const { y, velocity, height } = input
  const fraction = input.dismissFraction ?? DISMISS_FRACTION
  const projected = projectMomentum(y, velocity)
  const dismiss = projected > height * fraction
  return {
    target: dismiss ? height : 0,
    dismiss,
    projected,
    spring: Math.abs(velocity) >= FLING_VELOCITY ? "fling" : "default",
  }
}

/** Scrim opacity follows the sheet, so drag and fade can never disagree. */
export function scrimOpacity(y: number, height: number, max = 0.45): number {
  "worklet"
  if (height <= 0) return 0
  const open = 1 - Math.min(Math.max(y, 0), height) / height
  return open * max
}

/** Sheet height: tall, but always leaves a strip of the screen behind it visible. */
export function sheetHeight(windowHeight: number, topInset: number): number {
  const peek = Math.max(topInset, 24) + 12
  return Math.max(320, Math.round(windowHeight - peek))
}
