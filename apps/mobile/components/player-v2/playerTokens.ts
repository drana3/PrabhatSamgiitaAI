import { amColors, amDark } from "@/constants/tokens/amColors"
import { amTouchTarget } from "@/constants/tokens/amSpacing"

/**
 * Player-only sizes from spec SCR-12 that the shared am tokens do not carry.
 * Every colour and font still comes from constants/tokens.
 */
export const playerSize = {
  /** play/pause orange disc and its glyph */
  playDisc: 64,
  playGlyph: 26,
  /** previous / next */
  skip: 48,
  skipGlyph: 20,
  /** shuffle, repeat and the icon row */
  small: amTouchTarget,
  smallGlyph: 20,
  /** song title */
  title: 40,
  titleLine: 38,
  /** lyric rows */
  gloss: 11,
  /** drive mode (SCR-12 item 10) */
  drivePlayHeight: 96,
  driveSkipHeight: 72,
  driveGlyph: 36,
  /** scrubber */
  trackHeight: 4,
  thumb: 16,
  thumbPressed: 24,
  /** photograph behind the top of the screen */
  photoHeight: 240,
  /** room kept at the bottom for the tab bar branch */
  tabBarClearance: 96,
} as const

/** The Player is dark in both themes (spec section 1). */
export const playerColors = {
  ground: amColors.sage900,
  groundRaised: amColors.sage800,
  text: amColors.white,
  textSoft: "rgba(255, 255, 255, 0.72)",
  textFaint: "rgba(255, 255, 255, 0.45)",
  gold: amColors.gold300,
  brand: amColors.orange500,
  onBrand: amColors.white,
  trackBase: "rgba(255, 255, 255, 0.24)",
  glass: amDark.glass,
  glassStrong: amDark.glassStrong,
  glassEdge: amDark.glassEdge,
  line: amDark.line,
  scrim: "rgba(0, 0, 0, 0.45)",
  /** sage900 (#20281A) at 0% and 70% alpha, for the fade under the photograph */
  groundClear: "rgba(32, 40, 26, 0)",
  groundMostly: "rgba(32, 40, 26, 0.7)",
} as const

/** Lyric row opacity by state. */
export const lyricOpacity = { current: 1, done: 0.55, coming: 0.38 } as const
