/** Same formula as projectMomentum in amMotion, repeated here because it must run as a worklet. */
function project(position: number, velocity: number): number {
  "worklet"
  return position + (velocity / 1000) * (0.998 / (1 - 0.998))
}

/** UIScrollView-style rubber band: resistance grows as the finger goes further past the edge. */
export function rubberBand(offset: number, limit: number, coefficient = 0.55): number {
  "worklet"
  if (offset <= 0 || limit <= 0) return 0
  return (1 - 1 / ((offset * coefficient) / limit + 1)) * limit
}

/**
 * Position of a sheet under the finger, 1:1 with the grab point. Down is
 * positive. Dragging above the open position (negative) meets the rubber band.
 */
export function sheetPosition(start: number, translation: number, limit: number): number {
  "worklet"
  const raw = start + translation
  if (raw >= 0) return raw
  return -rubberBand(-raw, limit)
}

/**
 * Where the sheet settles after release. The landing point is the projection
 * of the current position along the velocity (dp/s), not the distance to the edge.
 */
export function sheetSettle(position: number, velocity: number, height: number): { target: number; fling: boolean } {
  "worklet"
  const projected = project(position, velocity)
  const target = projected > height * 0.5 ? height : 0
  // A throw carries momentum, so the spring may overshoot; a plain release does not.
  return { target, fling: Math.abs(velocity) > 600 }
}
