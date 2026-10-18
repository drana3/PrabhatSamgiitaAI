export const brandAssets = {
  /** Legacy cream mark (kept for surfaces that still need it) */
  logo: require("../assets/brand-logo.png"),
  /** Official navy/gold emblem — welcome UI + Expo icon/splash source */
  emblemClear: require("../assets/brand-emblem-clear.png"),
  /** @deprecated Prefer emblemClear — black-plate lockup cutouts look poor */
  logoClear: require("../assets/brand-logo-clear.png"),
  logoFull: require("../assets/brand-logo-full.png"),
  /** Face-centered crop for greeting / small chrome */
  guruAvatar: require("../assets/guru-avatar.png"),
  guruPortrait: require("../assets/guru-portrait.png"),
  guruQuote: require("../assets/guru-quote.png"),
  /** Left-biased crop — face more visible on About hero */
  guruQuoteHero: require("../assets/guru-quote-hero.png"),
  dawn: require("../assets/dawn-hero.png"),
} as const

export const guruCaption = {
  name: "Shrii Shrii Anandamurti ji",
  role: "Composer of Prabhat Samgiita",
  quote:
    "Prabhat Samgiita is the song of a new dawn — devotion, hope, nature, and the welfare of all.",
} as const
