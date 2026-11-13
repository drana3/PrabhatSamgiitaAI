import { rubberBand } from "./sheetPhysics"

/**
 * The horizontal pager of the text block (Lyrics | Translation | Word by word). Pure rules, no React; the ones the
 * screen runs per frame are worklets.
 *
 * The block is part of the page and scrolls with it like any other section. Nothing here moves with the page's
 * scroll. A finger moving sideways on the block drags the row of pages one to one, a flick lands on the next page; a
 * finger moving up or down belongs to the page: it scrolls.
 */

export const PAGE_COUNT = 3

/** Distance between two page dots (the moving mark travels one step per page). */
export const DOT_STEP = 28
/** A flick this fast (dp/s) carries the settling spring past the landing: only then may it overshoot. */
export const FLING_SPEED = 600
/** The page never makes the block shorter than this (an empty page still says its one honest line). */
export const MIN_VIEW = 120

/** A finger has to move this far (dp) before the pager decides anything. */
export const AXIS_SLOP = 8
/** A move to the side has to be this many times longer than the move up or down to count as a swipe. */
export const SIDE_BIAS = 1.8
/** ...and at least this long (dp). */
export const SIDE_MIN = 10

export type Axis = "none" | "x" | "y"

/**
 * Which way a finger that went `dx`, `dy` from where it touched down is going. Up and down wins every doubt: a
 * diagonal drag, a wobble, a drag that began as a scroll all belong to the page. Only a clear sideways move is a swipe.
 * "none" means it has not moved far enough to tell.
 */
export function decideAxis(dx: number, dy: number): Axis {
  "worklet"
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ax < AXIS_SLOP && ay < AXIS_SLOP) return "none"
  if (ax >= SIDE_MIN && ax >= ay * SIDE_BIAS) return "x"
  if (ay >= AXIS_SLOP) return "y"
  return "none"
}

function clampTo(x: number, lo: number, hi: number): number {
  "worklet"
  return x < lo ? lo : x > hi ? hi : x
}

/** The page at rest nearest to a fractional position. */
export function pageAt(pos: number, count: number = PAGE_COUNT): number {
  "worklet"
  return clampTo(Math.round(pos), 0, Math.max(0, count - 1)) + 0
}

/**
 * The row's offset (px, left is negative) at the page position `pos` with the finger's extra `drag` on top. Past the
 * first and last page the drag meets a rubber band instead of a hard stop; `rubber` is off while a spring settles.
 */
export function rowOffset(input: { pos: number; drag: number; width: number; count: number; rubber: boolean }): number {
  "worklet"
  const { pos, drag, width, count, rubber } = input
  const x = -pos * width + drag
  if (!rubber) return x
  const min = -(count - 1) * width
  if (x > 0) return rubberBand(x, width)
  if (x < min) return min - rubberBand(min - x, width)
  return x
}

/**
 * Which page a release lands on. The landing is the projection of the throw (current + (v/1000) * 0.998 / (1 - 0.998))
 * measured in pages, rounded to the nearest page, and never more than one page from where the gesture began, so a
 * hard flick is one page, not three. `x` is the row's raw offset (px, negative towards later pages), `velocity` the
 * finger's speed in dp/s (negative = towards the next page). Only a fast throw may overshoot.
 */
export function landingPage(input: { from: number; x: number; velocity: number; width: number; count: number }): { index: number; fling: boolean } {
  "worklet"
  const { from, x, velocity, width, count } = input
  if (width <= 0) return { index: from, fling: false }
  const projected = x + (velocity / 1000) * (0.998 / (1 - 0.998))
  const near = clampTo(Math.round(-projected / width), from - 1, from + 1)
  return { index: clampTo(near, 0, Math.max(0, count - 1)) + 0, fling: Math.abs(velocity) > FLING_SPEED }
}

/** The height of the block's window at the page position `pos`: between the heights of the two pages it is between. */
export function heightAt(pos: number, heights: readonly number[]): number {
  "worklet"
  const n = heights.length
  if (n === 0) return MIN_VIEW
  const p = clampTo(pos, 0, n - 1)
  const lo = Math.floor(p)
  const hi = Math.min(n - 1, lo + 1)
  const a = Math.max(MIN_VIEW, heights[lo] ?? 0)
  const b = Math.max(MIN_VIEW, heights[hi] ?? 0)
  return a + (b - a) * (p - lo)
}

/** The mark of the page dots: it moves one dot step per page and stays between the first and the last. */
export function dotMarkX(pos: number, count: number = PAGE_COUNT): number {
  "worklet"
  return clampTo(pos, 0, Math.max(0, count - 1)) * DOT_STEP
}
