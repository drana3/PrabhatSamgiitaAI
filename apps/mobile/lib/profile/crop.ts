/**
 * The maths of the profile photo crop. No React, no native modules: the crop sheet and the tests use it.
 *
 * Picture of `width x height` pixels sits behind a round window of `diameter` screen px. The state is
 *   scale: screen px per picture pixel,
 *   x, y:  where the picture's CENTRE is, measured from the window's centre, in screen px.
 * The window must always be fully covered by the picture, so
 *   scale >= minScale = diameter / min(width, height)
 *   |x| <= (width * scale - diameter) / 2   and the same for y.
 *
 * Beyond those limits a gesture meets a rubber band (`soft*`), and a release settles on the limit (`hard*`).
 * Functions that run in gesture worklets carry the "worklet" directive.
 */

export type ImageSize = { width: number; height: number }
export type CropState = { scale: number; x: number; y: number }
export type CropRect = { originX: number; originY: number; width: number; height: number }

/** Most the picture can be magnified: this many times the smallest scale that covers the window. */
export const MAX_ZOOM = 5
/** Where the centre of the window sits in a portrait picture by default: the upper third, where faces are. */
export const PORTRAIT_FOCUS_Y = 1 / 3
/** Apple's rubber-band constant. */
export const RUBBER_C = 0.55
/** A button press or a double tap magnifies by this factor. */
export const ZOOM_STEP = 1.25

export function minScale(image: ImageSize, diameter: number): number {
  "worklet"
  return diameter / Math.max(1, Math.min(image.width, image.height))
}

export function maxScale(image: ImageSize, diameter: number): number {
  "worklet"
  return minScale(image, diameter) * MAX_ZOOM
}

export function clampScale(scale: number, image: ImageSize, diameter: number): number {
  "worklet"
  return Math.min(maxScale(image, diameter), Math.max(minScale(image, diameter), scale))
}

/** How far the picture's centre may move from the window's centre at this scale, per axis. */
export function offsetLimits(image: ImageSize, diameter: number, scale: number): { x: number; y: number } {
  "worklet"
  return {
    x: Math.max(0, (image.width * scale - diameter) / 2),
    y: Math.max(0, (image.height * scale - diameter) / 2),
  }
}

/** Hard clamp: the window stays covered. */
export function clampOffset(value: number, limit: number): number {
  "worklet"
  return Math.min(limit, Math.max(-limit, value))
}

export function clampState(state: CropState, image: ImageSize, diameter: number): CropState {
  "worklet"
  const scale = clampScale(state.scale, image, diameter)
  const limit = offsetLimits(image, diameter, scale)
  return { scale, x: clampOffset(state.x, limit.x), y: clampOffset(state.y, limit.y) }
}

/**
 * Apple's rubber band: the distance moved on screen for a finger that went `distance` past the edge, of a
 * view `dimension` big. Starts at `c` (0.55) of the finger's distance and never passes `dimension`.
 */
export function rubberBand(distance: number, dimension: number, c: number = RUBBER_C): number {
  "worklet"
  if (distance <= 0) return 0
  const d = Math.max(1, dimension)
  return (1 - 1 / ((distance * c) / d + 1)) * d
}

/** Inside the limit the value is as it is; past it, it stretches with resistance. */
export function softOffset(value: number, limit: number, dimension: number): number {
  "worklet"
  if (value > limit) return limit + rubberBand(value - limit, dimension)
  if (value < -limit) return -limit - rubberBand(-limit - value, dimension)
  return value
}

/** The same for the scale: pinching past the smallest or the largest scale resists. */
export function softScale(scale: number, image: ImageSize, diameter: number): number {
  "worklet"
  const low = minScale(image, diameter)
  const high = maxScale(image, diameter)
  if (scale < low) return low - rubberBand(low - scale, low * 0.5)
  if (scale > high) return high + rubberBand(scale - high, high * 0.5)
  return scale
}

/** Where a throw released at `velocity` (px/s) lands, ignoring the edges: x + v/1000 * 0.998 / (1 - 0.998). */
export function projectOffset(value: number, velocity: number, rate = 0.998): number {
  "worklet"
  return value + (velocity / 1000) * (rate / (1 - rate))
}

/**
 * The state a photo opens in: smallest scale that covers the window, centred sideways, and in a portrait
 * picture the window's centre at the upper third (faces are there), as far as the picture allows.
 */
export function defaultCrop(image: ImageSize, diameter: number): CropState {
  "worklet"
  const scale = minScale(image, diameter)
  const focusY = image.height > image.width ? PORTRAIT_FOCUS_Y : 0.5
  return clampState({ scale, x: 0, y: (0.5 - focusY) * image.height * scale }, image, diameter)
}

/**
 * A new scale with one point of the window held still. `focal` is that point measured from the window's
 * centre (a finger, or the mouse pointer); the picture pixel under it stays under it. Not clamped.
 */
export function zoomAround(state: CropState, nextScale: number, focal: { x: number; y: number }): CropState {
  "worklet"
  const ratio = nextScale / state.scale
  return {
    scale: nextScale,
    x: focal.x - (focal.x - state.x) * ratio,
    y: focal.y - (focal.y - state.y) * ratio,
  }
}

/** Same as zoomAround, then clamped: a button press or a wheel step. */
export function zoomTo(state: CropState, nextScale: number, focal: { x: number; y: number }, image: ImageSize, diameter: number): CropState {
  "worklet"
  return clampState(zoomAround(state, clampScale(nextScale, image, diameter), focal), image, diameter)
}

/**
 * The square of the picture, in picture pixels, that the window shows. Whole numbers, inside the picture,
 * as large as the window allows: this is what the image manipulator crops before it resizes.
 */
export function cropRect(state: CropState, image: ImageSize, diameter: number): CropRect {
  const clamped = clampState(state, image, diameter)
  const smallest = Math.max(1, Math.min(image.width, image.height))
  const side = Math.max(1, Math.min(smallest, Math.round(diameter / clamped.scale)))
  const centerX = image.width / 2 - clamped.x / clamped.scale
  const centerY = image.height / 2 - clamped.y / clamped.scale
  const originX = Math.min(image.width - side, Math.max(0, Math.round(centerX - side / 2)))
  const originY = Math.min(image.height - side, Math.max(0, Math.round(centerY - side / 2)))
  return { originX, originY, width: side, height: side }
}

/** True when the state is the opening one (within half a pixel): the sheet then has nothing to Reset. */
export function isDefaultCrop(state: CropState, image: ImageSize, diameter: number): boolean {
  const base = defaultCrop(image, diameter)
  return Math.abs(state.scale - base.scale) < 0.001 && Math.abs(state.x - base.x) < 0.5 && Math.abs(state.y - base.y) < 0.5
}

/** The window's diameter for a stage: leaves a margin, never bigger than `cap`. */
export function windowDiameter(stageWidth: number, stageHeight: number, margin = 32, cap = 360): number {
  return Math.max(120, Math.min(cap, Math.min(stageWidth, stageHeight) - margin * 2))
}
