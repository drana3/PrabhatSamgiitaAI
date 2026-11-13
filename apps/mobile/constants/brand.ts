export const brandAssets = {
  /** Official navy/gold emblem — welcome UI + Expo icon/splash source */
  emblemClear: require("../assets/brand-emblem-clear.png"),
  /** @deprecated Prefer emblemClear — black-plate lockup cutouts look poor */
  logoClear: require("../assets/brand-logo-clear.png"),
  logoFull: require("../assets/brand-logo-full.png"),
  /**
   * Sunrise over a lake, used as a scenic background under text and buttons. The lake and sky only,
   * with no Baba in it. Baba's photographs are not here: they live in lib/photos/baba.ts and are shown
   * only by components/common/BabaPhoto, never under text.
   */
  dawn: require("../assets/dawn-clean.webp"),
} as const

export const guruCaption = {
  name: "Shrii Shrii Anandamurti ji",
  role: "Composer of Prabhat Samgiita",
  quote:
    "Prabhat Samgiita is the song of a new dawn — devotion, hope, nature, and the welfare of all.",
} as const
