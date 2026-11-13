import { amSpace } from "@/constants/tokens/amSpacing"

/**
 * THE rule for the space between blocks of a screen. Pure, so it is unit tested (__tests__/layoutRules.test.ts);
 * screens use <Section> and <Stack> (components/common/Layout.tsx) and take every vertical gap from this scale.
 * docs/layout-rules.md says why and how.
 *
 * Why this exists. Author and library pages used to carry their own numbers: a heading with `paddingTop: 30` here, a
 * row with no gap at all there, so a block touched the one above it on one screen and floated on another ("All
 * recordings" stuck to the last song, Play ran into the Demo tag). A gap that has to be written by hand gets
 * forgotten; a gap that is part of the component cannot be.
 */

/** The spacing scale (dp), the design system's 4px grid (constants/tokens/amSpacing.ts). Every vertical gap between blocks is one of these. */
export const SPACE: readonly Space[] = Object.values(amSpace)
export type Space = (typeof amSpace)[keyof typeof amSpace]

/** Air above a section heading: the same on every page, so two sections never look closer than two others. */
export const SECTION_TOP: Space = 32

/** Air between a heading and what it heads, and between the blocks of a stack. */
export const SECTION_GAP: Space = 12

/** Smallest gap allowed between two BLOCKS (a card and a button, a heading and a row). Text lines may be tighter. */
export const MIN_BLOCK_GAP: Space = 8

/** Side padding of the author and library pages. */
export const SCREEN_SIDE = 20

export function isOnScale(value: number): boolean {
  return (SPACE as readonly number[]).includes(value)
}

/** The scale value nearest to `value` (ties go up), for turning an old off-scale number into a scale one. */
export function nearestSpace(value: number): Space {
  let best: Space = SPACE[0]
  for (const step of SPACE) {
    if (Math.abs(step - value) < Math.abs(best - value) || (Math.abs(step - value) === Math.abs(best - value) && step > best)) best = step
  }
  return best
}
