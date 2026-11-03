/**
 * Navigation shell measurements (spec section 4a "Design plan", mockup .tabs / .mini).
 * Kept beside the other am tokens; imported directly (not through index.ts) so
 * parallel redesign branches do not collide on that file.
 */
export const amNav = {
  /** side inset of both floating pills */
  inset: 10,
  /** distance of the tab pill from the bottom edge (at least; the safe-area inset wins when larger) */
  tabBottom: 12,
  /** tab pill outer height */
  tabHeight: 68,
  /** padding between the pill edge and the indicator */
  tabPad: 6,
  /** indicator and tab button height */
  tabItemHeight: 56,
  /** gap between the tab pill and the mini-player pill */
  gap: 12,
  /** mini-player pill height */
  miniHeight: 64,
  /** pill radius (spec: sheets and floating pills 40) */
  radius: 40,
  /** tab pill blur (spec: glass 14px) and mini-player blur (24px) */
  tabBlur: 14,
  miniBlur: 24,
  /** opacity of the mini-player pill: white at 38% in Light, forest at 42% in Dark */
  miniAlphaLight: 0.38,
  miniAlphaDark: 0.42,
  /** the tab pill when it turns dark on the Player tab: forest at 78% */
  tabDarkAlpha: 0.78,
  /** label colour of inactive tabs on the dark pill */
  tabDarkInactiveAlpha: 0.78,
  /** edge of the dark pill / mini pill, white at this alpha */
  darkEdgeAlpha: 0.18,
  /**
   * expo-blur takes an intensity (1 to 100), not pixels. These approximate the 14px / 24px
   * of the spec and have to be tuned on a device.
   */
  tabBlurIntensity: 40,
  miniBlurIntensity: 70,
  /** progress hairline under the mini-player text */
  miniBarHeight: 3,
  /** scale of the indicator while the finger is down */
  pressedScale: 0.96,
} as const
