export const brandAssets = {
  /** Official navy/gold emblem — welcome UI + Expo icon/splash source */
  emblemClear: require("../assets/brand-emblem-clear.png"),
  /** @deprecated Prefer emblemClear — black-plate lockup cutouts look poor */
  logoClear: require("../assets/brand-logo-clear.png"),
  logoFull: require("../assets/brand-logo-full.png"),
  /** Face-centered crop for greeting / small chrome */
  guruAvatar: require("../assets/guru-avatar.png"),
  guruPortrait: require("../assets/guru-portrait.png"),
  guruQuote: require("../assets/guru-quote.webp"),
  dawn: require("../assets/dawn-hero.webp"),
} as const

export const guruCaption = {
  name: "Shrii Shrii Anandamurti ji",
  role: "Composer of Prabhat Samgiita",
  quote:
    "Prabhat Samgiita is the song of a new dawn — devotion, hope, nature, and the welfare of all.",
} as const
