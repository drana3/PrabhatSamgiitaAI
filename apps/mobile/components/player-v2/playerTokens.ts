import { amColors, amDarkSurface } from "@/constants/tokens/amColors"

/**
 * Player-only sizes and colours, copied from the prototype
 * (public/mockup/Main.dc.html, section "player: dark forest", .p-*, .ctrls, .pbar,
 * .wave, .drive-*, .vchip, .vscope, .kw, .qrow, .sheet). Every colour that exists in
 * the am tokens is taken from there; the white-alpha values are the prototype's own.
 */
export const playerSize = {
  /** the prototype's status-bar band; used when the platform reports no top inset (web) */
  topBand: 54,
  /** playing-from row */
  topBar: 56,
  topBarInsetLeft: 20,
  topBarInsetRight: 10,
  /** srcchip and Aa button */
  topButton: 44,
  topIcon: 26,
  chevron: 18,
  /** photograph and the fade over it */
  photoHeight: 520,
  /** title block */
  titleGap: 18,
  titleLift: -8,
  titleFont: 30,
  titleLine: 28.5,
  /** version chip */
  chipHeight: 32,
  chipIcon: 14,
  /** "Play: This version | All N versions" */
  scopeHeight: 40,
  scopePad: 4,
  scopeIcon: 15,
  /** karaoke panel */
  panelMarginTop: 16,
  panelRadius: 30,
  /** thin seek line: touch area, track, dot (grows while dragging) */
  thinHit: 32,
  thinTrack: 3,
  thinDot: 10,
  thinDotGrown: 14,
  /** transport */
  small: { w: 44, h: 56 },
  skip: 48,
  playDisc: 64,
  smallGlyph: 20,
  playGlyph: 26,
  /** utility bar */
  util: 48,
  utilGlyph: 24,
  /** drive mode */
  drivePlayHeight: 96,
  driveSkipHeight: 72,
  driveGlyph: 28,
  drivePlayGlyph: 40,
  thickHit: 44,
  thickTrack: 8,
  /** room kept at the bottom for the tab bar (prototype: padding-bottom 96) */
  tabBarClearance: 96,
} as const

export const playerColors = {
  /** neutral near-black under the cover tint (was forest): the tint reads as a colour over black */
  ground: amDarkSurface.page,
  text: amColors.white,
  textSoft: "rgba(255, 255, 255, 0.82)",
  textFaint: "rgba(255, 255, 255, 0.7)",
  gold: amColors.gold300,
  sun: amColors.logoSun,
  brand: amColors.orange500,
  onBrand: amColors.white,
  /** --am-glass-dark */
  glassDark: "rgba(18, 17, 16, 0.35)",
  /** border of the round glass buttons */
  glassEdge: "rgba(255, 255, 255, 0.35)",
  /** version chip */
  chipFill: "rgba(255, 255, 255, 0.18)",
  chipEdge: "rgba(255, 255, 255, 0.3)",
  /** "Play" switch */
  scopeFill: "rgba(255, 255, 255, 0.12)",
  scopeEdge: "rgba(255, 255, 255, 0.24)",
  scopeText: "rgba(255, 255, 255, 0.84)",
  scopeLabel: "rgba(255, 255, 255, 0.7)",
  /** karaoke panel */
  panelFill: "rgba(18, 17, 16, 0.78)",
  panelEdge: "rgba(255, 255, 255, 0.16)",
  /** the fade over the photograph */
  fadeTop: "rgba(18, 17, 16, 0.30)",
  fadeMid: "rgba(18, 17, 16, 0.62)",
  /** waveform and thick scrubber */
  waveOff: "rgba(255, 255, 255, 0.32)",
  thickTrack: "rgba(255, 255, 255, 0.3)",
  /** utility icons */
  utilIcon: "rgba(255, 255, 255, 0.86)",
  /** drive "util" pill */
  driveEdge: "rgba(255, 255, 255, 0.28)",
  scrim: "rgba(30, 30, 30, 0.45)",
  /** transparent forest at the edge of the lyric scroll area */
  maskClear: "rgba(18, 17, 16, 0)",
} as const

/** Karaoke word / translation colours by state (.kw, .kw.past, .kl-on, .sung, .now, .ktr). */
export const karaokeColors = {
  word: {
    coming: "rgba(255, 255, 255, 0.4)",
    past: "rgba(255, 255, 255, 0.7)",
    onLine: "rgba(255, 255, 255, 0.66)",
    sung: "#FFFFFF",
    now: amColors.gold300,
  },
  translation: {
    coming: "rgba(255, 255, 255, 0.46)",
    past: "rgba(255, 255, 255, 0.5)",
    onLine: "rgba(255, 255, 255, 0.86)",
  },
} as const

/** Queue sheet rows (.qrow). */
export const queueColors = {
  row: "rgba(255, 255, 255, 0.08)",
  rowNow: "rgba(245, 194, 83, 0.16)",
  sub: "rgba(255, 255, 255, 0.78)",
  handle: "rgba(255, 255, 255, 0.7)",
  grab: "rgba(255, 255, 255, 0.45)",
  heading: "rgba(255, 255, 255, 0.6)",
} as const
