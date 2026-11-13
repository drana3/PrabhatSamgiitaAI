import { amNav } from "@/constants/tokens/amNav"

/**
 * Pure maths of the song page's collapsing top bar and its pinned tab strip (no React), so the
 * mapping from the scroll offset to what is drawn is unit tested. The page feeds these into
 * reanimated `useAnimatedStyle` blocks, so every function is a worklet and runs on the UI thread.
 *
 * The bar works like the playlist page of Spotify: the round back button is always there; as the
 * hero scrolls away the bar's ground fades in, then the song title, then the round Play button.
 * Each of the three follows the scroll offset 1:1 (a ramp between two offsets), never a timer,
 * so scrubbing back and forth never makes anything jump.
 */

/** Where things sit on the page, in content coordinates (y from the top of the scrolled content). */
export type BarMarks = {
  /** Height of the bar including the safe-area top. */
  barHeight: number
  coverTop: number
  coverBottom: number
  /** Bottom of the title text in the hero. */
  titleBottom: number
  /** Top and bottom of the big round Play button in the action row. */
  playTop: number
  playBottom: number
}

export type BarValues = {
  /** 0..1 opacity of the tinted ground. */
  bg: number
  /** 0..1 opacity of the centered title. */
  title: number
  /** px the title still has to rise (8 at 0, 0 at 1). */
  titleShift: number
  /** 0..1 opacity of the Play button on the right. */
  button: number
  /** px the Play button still has to rise. */
  buttonShift: number
}

/** 0 up to `from`, 1 from `to`, linear in between. */
export function ramp(y: number, from: number, to: number): number {
  "worklet"
  if (to <= from) return y >= to ? 1 : 0
  const p = (y - from) / (to - from)
  return p < 0 ? 0 : p > 1 ? 1 : p
}

/** Length of the fade of each part of the bar, in px of scrolling. */
export const BAR_FADE = { bg: 120, title: 36, button: 40 } as const

/** Scroll offsets where each part of the bar starts and ends its fade. */
export function barRanges(marks: BarMarks): {
  bg: [number, number]
  title: [number, number]
  button: [number, number]
} {
  "worklet"
  // the ground is full once the cover has gone under the bar
  const bgTo = marks.coverBottom - marks.barHeight
  // the title shows as the hero title goes under the bar
  const titleTo = marks.titleBottom - marks.barHeight
  // the button shows as the big Play button goes under it
  const buttonTo = marks.playBottom - marks.barHeight
  return {
    bg: [bgTo - BAR_FADE.bg, bgTo],
    title: [titleTo - BAR_FADE.title, titleTo],
    button: [buttonTo - BAR_FADE.button, buttonTo],
  }
}

/** Everything the bar draws for a scroll offset. Negative offsets (the iOS rubber band) count as 0. */
export function stickyBarValues(scrollY: number, marks: BarMarks): BarValues {
  "worklet"
  const y = scrollY < 0 ? 0 : scrollY
  const r = barRanges(marks)
  const bg = ramp(y, r.bg[0], r.bg[1])
  const title = ramp(y, r.title[0], r.title[1])
  const button = ramp(y, r.button[0], r.button[1])
  return { bg, title, titleShift: (1 - title) * 8, button, buttonShift: (1 - button) * 10 }
}

/** Offset of the pinned tab strip: its place in the content, but never higher than under the bar. */
export function stripTop(natural: number, scrollY: number, pin: number): number {
  "worklet"
  const y = natural - scrollY
  return y > pin ? y : pin
}

/** 0..1 hairline under the pinned strip: it appears over 12px of scrolling after the strip reached the bar. */
export function stripHairline(natural: number, scrollY: number, pin: number): number {
  "worklet"
  return ramp(scrollY, natural - pin, natural - pin + 12)
}

/**
 * Scale and fade of the cover while the page scrolls: it shrinks to 80% and fades by the time it is under the
 * bar, and grows a little when the page is pulled down past the top (rubber band).
 */
export function coverTransform(scrollY: number, coverHeight: number): { scale: number; opacity: number; lift: number } {
  "worklet"
  if (scrollY <= 0) {
    const pull = -scrollY
    return { scale: 1 + Math.min(0.2, pull / 900), opacity: 1, lift: 0 }
  }
  const p = ramp(scrollY, 0, coverHeight)
  return { scale: 1 - 0.2 * p, opacity: 1 - 0.85 * p, lift: scrollY * 0.35 }
}

/**
 * Bottom padding of the scrolling page so its last row clears the floating mini-player pill. A pushed screen
 * has no tab bar, so the pill sits just above the bottom safe area (lib/navV2 miniBottomFor).
 */
export function pageBottomInset(input: { safeBottom: number; miniVisible: boolean }): number {
  const tabBottom = Math.max(input.safeBottom, amNav.tabBottom)
  // pill height and the gap above it, plus 24 of air; without the pill only the air
  return input.miniVisible ? tabBottom + amNav.miniHeight + amNav.gap + 24 : tabBottom + 24
}
