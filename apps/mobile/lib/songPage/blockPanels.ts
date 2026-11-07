import { BLOCK_TABS, type BlockTab } from "./blockTabs"
import { rubberBand } from "./sheetPhysics"

/**
 * The text block as three panels side by side (Lyrics, Commentary, Word by word) in a PINNED STAGE (board 6,
 * variant 5, with the pinned scroll of anandamargi.org). Pure rules, no React; every function that the screen runs
 * per frame is a worklet.
 *
 * One timeline drives everything. Let `rel` be how far the page has scrolled past the point where the stage pins
 * (page scroll minus `pinStart`). The stage holds still on screen for `pinDistance` pixels of scroll. In that stretch,
 * for each panel in turn:
 *   1. READ: the panel is taller than the stage by `overflow` pixels; its text moves up inside the stage, one pixel
 *      of text per pixel of scroll (this is plain reading, just with the page chrome held still);
 *   2. SLIDE: the row of panels moves one stage width to the left, one pixel of panel per pixel of scroll (the
 *      same one-to-one rule as the pinned rail of the Ananda Marga site). The next panel arrives at its top.
 * A panel that fits in the stage has no overflow and no read step, so for a short song the whole pin is the two
 * slides: two stage widths of scroll.
 *
 * Why not "vertical scroll only moves the panels sideways" with a clipped, fixed-height stage: a panel taller than the
 * screen would have no way to be read at all. And not a nested vertical scroller inside the stage: the page scroll and
 * the inner scroll fight over the same finger, and a phone has no scroll chaining. One timeline, one scroll, no fight.
 */

export const PANEL_COUNT = BLOCK_TABS.length

/** The room the stage's header takes: the label row, the page dots. */
export const PANELS_HEAD = 76
/** The air above a panel's first line (the soft edge under the header fades into it). */
export const PANEL_TOP = 10
/** The air under a panel's last line, and under the Lyrics panel the room for the reading strip's compact card. */
export const PANEL_FOOT = 28
export const LYRICS_FOOT = 120
/** The panels never make the stage shorter than this (an empty panel still says its one honest line). */
export const MIN_VIEW = 160
/** A flick this fast (dp/s) carries the settling spring past the landing: only then may it overshoot. */
export const FLING_SPEED = 600
/** Distance between two page dots (the moving mark travels one step per panel). */
export const DOT_STEP = 28

export type PanelsLayout = {
  /** the stage's width: one slide travels this far */
  width: number
  /** how far each panel's text runs below the stage (0 when it fits) */
  overflows: readonly number[]
}

function clampTo(x: number, lo: number, hi: number): number {
  "worklet"
  return x < lo ? lo : x > hi ? hi : x
}

/** Where the stage and the panels are for the measured sizes (no React, so the screen's numbers are testable). */
export type PanelsFrame = {
  /** the height of the panels' window inside the stage */
  view: number
  /** the stage's whole height: header plus window */
  stage: number
  layout: PanelsLayout
  /** how many pixels of page scroll the pin lasts */
  distance: number
}

/**
 * The sizes. `contents` are the natural heights of the panels (their text plus the foot); `available` is the height
 * the screen leaves for the stage under the bars. The window is as tall as the tallest panel, up to what the screen
 * leaves; a taller panel overflows and is read inside the pin.
 */
export function buildFrame(input: { width: number; contents: readonly number[]; available: number }): PanelsFrame {
  const { width, contents, available } = input
  const tallest = contents.reduce((m, h) => Math.max(m, h), 0)
  const room = Math.max(MIN_VIEW, available - PANELS_HEAD)
  const view = Math.round(Math.min(room, Math.max(MIN_VIEW, tallest)))
  const overflows = contents.map((h) => Math.max(0, Math.round(h - view)))
  const layout: PanelsLayout = { width, overflows }
  return { view, stage: view + PANELS_HEAD, layout, distance: pinDistance(layout) }
}

/** The scroll (from the pin) at which panel `i` is at rest on screen with its text at the top. */
export function panelStart(layout: PanelsLayout, i: number): number {
  "worklet"
  let y = 0
  for (let k = 0; k < i; k++) y += (layout.overflows[k] ?? 0) + layout.width
  return y
}

/** The scroll at which panel `i` has been read to its last line and is about to slide away. */
export function panelReadEnd(layout: PanelsLayout, i: number): number {
  "worklet"
  return panelStart(layout, i) + (layout.overflows[i] ?? 0)
}

/** How many pixels of scroll the stage is held: every panel's read, plus one stage width for each slide between. */
export function pinDistance(layout: PanelsLayout): number {
  "worklet"
  const n = layout.overflows.length
  return n === 0 ? 0 : panelReadEnd(layout, n - 1)
}

/** How far down the stage sits inside its block: nothing before the pin, held still (it is pushed down by exactly the scroll) during it, left behind after. */
export function stageShift(scroll: number, pinStart: number, distance: number): number {
  "worklet"
  return clampTo(scroll - pinStart, 0, distance)
}

/** Where the row of panels is, as a fractional panel number: 0 is Lyrics at rest, 1 Commentary, 2 Word by word. */
export function panelPosAt(layout: PanelsLayout, rel: number): number {
  "worklet"
  const n = layout.overflows.length
  if (n < 2 || layout.width <= 0) return 0
  const r = clampTo(rel, 0, pinDistance(layout))
  for (let i = 0; i < n - 1; i++) {
    const end = panelReadEnd(layout, i)
    if (r < end) return i
    if (r < end + layout.width) return i + (r - end) / layout.width
  }
  return n - 1
}

/** How far panel `i`'s text has moved up inside the stage at `rel`. */
export function readOffsetAt(layout: PanelsLayout, rel: number, i: number): number {
  "worklet"
  return clampTo(rel - panelStart(layout, i), 0, layout.overflows[i] ?? 0)
}

/**
 * Where the reading strip's idea of "page scroll" must stand so that the lyrics' place on screen is right: the page
 * scroll, less what the stage was pushed down, plus how far the lyrics' text has moved up inside it.
 */
export function readingScroll(layout: PanelsLayout, scroll: number, pinStart: number): number {
  "worklet"
  return scroll - stageShift(scroll, pinStart, pinDistance(layout)) + readOffsetAt(layout, scroll - pinStart, 0)
}

/** The panel at rest nearest to a fractional position. */
export function panelAt(pos: number, count: number = PANEL_COUNT): number {
  "worklet"
  return clampTo(Math.round(pos), 0, Math.max(0, count - 1)) + 0
}

export function panelTab(index: number): BlockTab {
  return BLOCK_TABS[clampTo(Math.round(index), 0, PANEL_COUNT - 1)] as BlockTab
}

export function panelIndexOf(tab: BlockTab): number {
  return Math.max(0, BLOCK_TABS.indexOf(tab))
}

/** Where the compact reading strip may show: only while the Lyrics panel is the one on screen. */
export function stripPanelOn(pos: number): boolean {
  return panelAt(pos) === 0
}

/**
 * The row's offset (px, left is negative) at position `pos` with the finger's extra `drag` on top. Past the first and
 * last panel the drag meets a rubber band instead of a hard stop; `rubber` is off while a spring is settling.
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
 * Which panel a release lands on. The landing is the projection of the throw (current + (v/1000) * 0.998 / (1 - 0.998))
 * measured in panels, rounded to the nearest panel, and never more than one panel from where the gesture began, so a
 * hard flick is one page, not three. `x` is the row's raw offset (px, negative towards later panels), `velocity` the
 * finger's speed in dp/s (negative = towards the next panel). Only a fast throw may overshoot.
 */
export function landingPanel(input: { from: number; x: number; velocity: number; width: number; count: number }): { index: number; fling: boolean } {
  "worklet"
  const { from, x, velocity, width, count } = input
  if (width <= 0) return { index: from, fling: false }
  const projected = x + (velocity / 1000) * (0.998 / (1 - 0.998))
  const near = clampTo(Math.round(-projected / width), from - 1, from + 1)
  return { index: clampTo(near, 0, Math.max(0, count - 1)) + 0, fling: Math.abs(velocity) > FLING_SPEED }
}

/**
 * The scroll (from the pin) that matches landing on panel `index` when the page stood at `rel0`. A panel that is
 * already the one on screen, exactly, keeps the scroll it has (a swipe that comes back is not a scroll). Half way
 * through a slide, the two panels of that slide land where the slide joins them (the read end of the one leaving, the
 * top of the one arriving), so the picture does not jump. Any other panel is entered at its top.
 */
export function settleScroll(layout: PanelsLayout, rel0: number, index: number): number {
  "worklet"
  const pos = panelPosAt(layout, rel0)
  const at = Math.round(pos)
  // at rest on a panel: that panel keeps its scroll, any other is entered at its top
  if (Math.abs(pos - at) < 1e-3) return index === at ? rel0 : panelStart(layout, index)
  // half way through a slide: its two panels land at the edges the slide joins them by, any other at its top
  const lo = Math.floor(pos)
  if (index === lo) return panelReadEnd(layout, lo)
  if (index === lo + 1) return panelStart(layout, lo + 1)
  return panelStart(layout, index)
}

/**
 * The page scroll a jump to panel `index` ends at: the panel at rest at the top of the pinned stage. Lyrics (the first
 * panel) leaves the block a little under the strip, the way a jump to any section does.
 */
export function jumpScroll(layout: PanelsLayout, pinStart: number, index: number, lead = 24): number {
  "worklet"
  return index <= 0 ? Math.max(0, pinStart - lead) : pinStart + panelStart(layout, index)
}

/** The mark of the page dots: it moves one dot step per panel and stays between the first and the last. */
export function dotMarkX(pos: number, count: number = PANEL_COUNT): number {
  "worklet"
  return clampTo(pos, 0, Math.max(0, count - 1)) * DOT_STEP
}
