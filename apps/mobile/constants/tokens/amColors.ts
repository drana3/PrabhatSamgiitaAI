/**
 * Colour tokens of the Ananda Marga design system (anandamarga.org).
 * Source of truth: apps/web/src/styles/tokens/colors.css in the am-site project.
 * Values are copied, not re-typed; change them there first.
 */
export const amColors = {
  orange50: "#FFEFE4",
  orange100: "#FFDCC5",
  orange200: "#FFB98A",
  orange300: "#FB9A5A",
  orange400: "#FB7122",
  orange500: "#F67931",
  orange600: "#E5610F",
  orange700: "#B94D0C",
  /** pressed action fill, and accent TEXT on light surfaces (6.2:1 on sand200, 7.5:1 on white) */
  orange800: "#8F3B08",

  gold100: "#FEFAD0",
  gold300: "#F5C253",
  gold500: "#E9A92E",
  logoSun: "#FECC31",

  olive100: "#DFE5C6",
  olive700: "#5B6B24",

  sage50: "#EFF0EB",
  sage100: "#EFEEE4",
  sage200: "#E5E4D4",
  sage300: "#C4CBAF",
  sage500: "#777B6C",
  sage700: "#3C5535",
  sage800: "#2C3A27",
  sage900: "#20281A",

  sand50: "#F8F6F3",
  sand100: "#F5F2EF",
  sand200: "#EEE9E5",
  sand300: "#E9E4E0",
  sand400: "#D8D1CA",

  white: "#FFFFFF",
  ink900: "#1E1E1E",
  ink800: "#333333",
  ink600: "#525252",
  ink500: "#68635F",
  ink400: "#999999",
  ink300: "#B3B3B3",
  ink200: "#CCCCCC",

  tintGreen: "#E8F1D4",
  tintBlue: "#CCEBFE",
  tintYellow: "#FEFAD0",
  tintPeach: "#FFDCC5",
  danger: "#EC221F",
  /** error TEXT on light surfaces (6.9:1 on white, 5.7:1 on sand200); `danger` is for graphics and fills only */
  dangerText: "#B3150E",
  /**
   * Second tone of the big two-tone display headings ("SONGS" + grey count): the lightest grey that
   * still gives 4:1 on sand200 and the peach page wash. ink400/300/200 are never text colours.
   */
  headingSecond: "#77716B",
} as const

export interface AmTheme {
  /** page ground */
  page: string
  /** raised surface under cards */
  raised: string
  card: string
  /** inner surface inside a card */
  inner: string
  line: string
  textHeading: string
  textBody: string
  textMuted: string
  /** small uppercase labels */
  eyebrow: string
  /** second tone of two-tone display headings (large text, at least 4:1) */
  headingSecond: string
  /**
   * Action fill: the ONE primary button, the selected chip/tab pill. orange700 in Light and Dark.
   * Text on it is always `onBrand` (white). Never put text on `accentBright`.
   */
  brand: string
  /** pressed action fill (orange800) */
  brandPress: string
  onBrand: string
  /** bright orange (orange500): icons, progress and scrubber fill, dots, equaliser bars, focus rings, glows. Never behind text. */
  accentBright: string
  /** accent TEXT: orange800 on light surfaces, orange500 on dark surfaces (at least 4.5:1) */
  accentText: string
  /** error text (4.5:1+ on every surface of the theme) */
  dangerText: string
  /** Player and quiz card ground */
  forest: string
  glass: string
  glassStrong: string
  glassEdge: string
}

export const amLight: AmTheme = {
  page: amColors.sand200,
  raised: amColors.sand100,
  card: amColors.white,
  inner: amColors.sand100,
  line: amColors.sand300,
  textHeading: amColors.ink800,
  textBody: amColors.ink600,
  textMuted: amColors.ink500,
  eyebrow: amColors.orange800,
  headingSecond: amColors.headingSecond,
  brand: amColors.orange700,
  brandPress: amColors.orange800,
  onBrand: amColors.white,
  accentBright: amColors.orange500,
  accentText: amColors.orange800,
  dangerText: amColors.dangerText,
  forest: amColors.sage900,
  glass: "rgba(255, 255, 255, 0.55)",
  glassStrong: "rgba(255, 255, 255, 0.9)",
  glassEdge: "rgba(255, 255, 255, 0.7)",
}

/**
 * Dark theme: the same tokens re-mapped (spec section 1).
 * Orange buttons keep white text.
 */
/**
 * The ONE place dark surfaces are defined: neutral near-black with a barely warm tint
 * (Spotify structure, orange where Spotify uses green). amDark, protoDark, spDark, the
 * Songs and Learn themes, the mini player and the tab pill all read from here.
 * Contrast (WCAG): heading 15:1+, body 6:1+, muted 4.8:1+ on page/raised/card/inner.
 * `muted` is NOT allowed on `tile` (4.38:1): use `body` there (5.6:1).
 */
export const amDarkSurface = {
  page: "#121110",
  raised: "#181614",
  card: "#1C1A18",
  inner: "#262320",
  /** progress tracks, hairlines that must read as solid, pressed fills */
  tile: "#2E2A27",
  line: "rgba(255, 255, 255, 0.09)",
  heading: "#F4F1EC",
  body: "#A8A29A",
  muted: "#948E86",
  /** warm tint of orange on dark: selected chips behind text, peach tiles */
  peach: "#3A2418",
  glass: "rgba(28, 26, 24, 0.55)",
  glassStrong: "rgba(28, 26, 24, 0.78)",
  glassSolid: "rgba(24, 22, 20, 0.94)",
  glassEdge: "rgba(255, 255, 255, 0.14)",
  /** text and icons on the light (white/ink) controls in dark */
  onLight: "#121110",
  /** error text on dark surfaces (6.2:1+ on inner) */
  dangerText: "#FF7A74",
} as const

export const amDark: AmTheme = {
  page: amDarkSurface.page,
  raised: amDarkSurface.raised,
  card: amDarkSurface.card,
  inner: amDarkSurface.inner,
  line: amDarkSurface.line,
  textHeading: amDarkSurface.heading,
  textBody: amDarkSurface.body,
  textMuted: amDarkSurface.muted,
  eyebrow: amColors.gold300,
  headingSecond: amDarkSurface.muted,
  brand: amColors.orange700,
  brandPress: amColors.orange800,
  onBrand: amColors.white,
  accentBright: amColors.orange500,
  accentText: amColors.orange500,
  dangerText: amDarkSurface.dangerText,
  forest: amColors.sage900,
  glass: amDarkSurface.glass,
  glassStrong: "rgba(28, 26, 24, 0.92)",
  glassEdge: amDarkSurface.glassEdge,
}

/**
 * Scrims for text over photography. Text on a photo ALWAYS sits on a scrim: `bottom` behind the
 * title block, `top` behind top-left labels. Chips on photos are neutral only (`amPhotoChip`).
 */
export const amScrimPhoto = ["rgba(0,0,0,0)", "rgba(0,0,0,0.72)"] as const
export const amScrimPhotoTop = ["rgba(0,0,0,0.45)", "rgba(0,0,0,0)"] as const

/**
 * The only two chip looks allowed ON a photograph: dark glass + white text (13.7:1), or a
 * white chip + ink800 text (12.6:1). No green, orange or gold chips over images.
 */
export const amPhotoChip = {
  glass: { bg: "rgba(18, 17, 16, 0.72)", fg: "#FFFFFF" },
  white: { bg: "#FFFFFF", fg: "#333333" },
} as const
export const amGradientBrand = ["#F67931", "#FB7122"] as const
