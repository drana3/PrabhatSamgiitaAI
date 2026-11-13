/**
 * These run on the UI thread while a finger is down, so each one is a
 * Reanimated worklet and uses only its own arguments and module constants.
 * `project` is the spec formula from constants/tokens/amMotion.projectMomentum
 * (a test keeps the two equal).
 */
const DECELERATION = 0.998

export function project(x: number, velocity: number): number {
  "worklet"
  return x + (velocity / 1000) * (DECELERATION / (1 - DECELERATION))
}

/** iOS-style rubber band: the further past the edge, the less it moves. */
export function rubberBand(overshoot: number, limit: number, coefficient = 0.55): number {
  "worklet"
  if (overshoot <= 0 || limit <= 0) return 0
  return (1 - 1 / ((overshoot * coefficient) / limit + 1)) * limit
}

/** Offset with resistance past [min, max]. */
export function rubberBandClamp(value: number, min: number, max: number, limit: number): number {
  "worklet"
  if (value < min) return min - rubberBand(min - value, limit)
  if (value > max) return max + rubberBand(value - max, limit)
  return value
}

/**
 * Scrub 1:1 with the finger, relative to where it was grabbed: touching the
 * thumb never makes it jump; touching the track away from it moves the thumb
 * under the finger.
 */
export function scrubRatio(input: {
  touchDownX: number
  touchX: number
  width: number
  startRatio: number
  thumbRadius: number
}): number {
  "worklet"
  if (input.width <= 0) return 0
  const thumbX = input.startRatio * input.width
  const grabbedThumb = Math.abs(input.touchDownX - thumbX) <= input.thumbRadius
  const raw = grabbedThumb
    ? input.startRatio + (input.touchX - input.touchDownX) / input.width
    : input.touchX / input.width
  return Math.min(1, Math.max(0, raw))
}

export function secondsFromRatio(ratio: number, duration: number): number {
  "worklet"
  return Math.min(1, Math.max(0, ratio)) * Math.max(0, duration)
}

/**
 * Where a sheet settles after release: the snap point nearest to the
 * momentum projection of its position (spec: x + v/1000 * 0.998/(1-0.998)).
 */
export function settleSnap(position: number, velocity: number, snapPoints: number[]): number {
  "worklet"
  const landing = project(position, velocity)
  let best = snapPoints[0] as number
  for (const point of snapPoints) {
    if (Math.abs(point - landing) < Math.abs(best - landing)) best = point
  }
  return best
}

/** Swipe-to-remove: remove when the projected landing passes the threshold. */
export function swipeRemoves(offset: number, velocity: number, threshold: number): boolean {
  "worklet"
  return Math.abs(project(offset, velocity)) >= threshold
}

/**
 * Whether letting go of the scrub bar should seek. A tap that never moved ends the pan as "failed" but
 * still means "go here". A gesture that was interrupted (the player was swiped closed, a call came in,
 * another gesture took over) must not move the song.
 */
export function shouldSeekOnRelease(input: { activated: boolean; success: boolean; touchesCancelled: boolean }): boolean {
  "worklet"
  if (input.touchesCancelled) return false
  if (input.activated && !input.success) return false
  return true
}
