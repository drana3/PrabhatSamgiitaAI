/** Spacing, radius and layout roles from the Ananda Marga design system. */

/** Base scale on the 4px grid. */
export const amSpace = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s6: 24,
  s8: 32,
  s12: 48,
  s16: 64,
  s24: 96,
  s32: 128,
} as const

/** Spacing roles measured on the site; every distance on a screen is one of these. */
export const amGap = {
  /** page side padding */
  gutter: 10,
  /** between two sections of a screen (phone value, 40 to 60 in the spec) */
  section: 60,
  /** inside a section: title, content, button */
  block: 20,
  /** between cards or tiles in a grid */
  grid: 10,
  /** heading to its text inside one column */
  text: 15,
  /** inside a card or tile */
  padCard: 20,
  /** inside a large coloured panel */
  padPanel: 25,
} as const

export const amRadius = {
  sm: 12,
  md: 18,
  /** content cards */
  card: 20,
  /** photo panels, learn cards */
  panel: 30,
  /** sheets, floating pills */
  sheet: 40,
  /** buttons */
  pill: 70,
  full: 9999,
} as const

export const amControl = {
  /** pill button and search field height */
  pillHeight: 48,
} as const

export const amTouchTarget = 44
