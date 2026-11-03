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
  /** buttons, active tab, progress. Text on it is always white. */
  brand: string
  brandPress: string
  onBrand: string
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
  textBody: amColors.ink500,
  textMuted: amColors.ink400,
  eyebrow: amColors.orange700,
  brand: amColors.orange500,
  brandPress: amColors.orange700,
  onBrand: amColors.white,
  forest: amColors.sage900,
  glass: "rgba(255, 255, 255, 0.55)",
  glassStrong: "rgba(255, 255, 255, 0.9)",
  glassEdge: "rgba(255, 255, 255, 0.7)",
}

/**
 * Dark theme: the same tokens re-mapped (spec section 1).
 * Orange buttons keep white text.
 */
export const amDark: AmTheme = {
  page: "#161B12",
  raised: "#1C2217",
  card: "#222B1D",
  inner: "#262F20",
  line: "rgba(255, 255, 255, 0.12)",
  textHeading: "#F2EFE9",
  textBody: "#B7BCA6",
  textMuted: "#8C917F",
  eyebrow: amColors.gold300,
  brand: amColors.orange500,
  brandPress: amColors.orange600,
  onBrand: amColors.white,
  forest: amColors.sage900,
  glass: "rgba(34, 43, 29, 0.55)",
  glassStrong: "rgba(34, 43, 29, 0.92)",
  glassEdge: "rgba(255, 255, 255, 0.16)",
}

/** Scrim for text over photography. */
export const amScrimPhoto = ["rgba(0,0,0,0)", "rgba(0,0,0,0.58)"] as const
export const amGradientBrand = ["#F67931", "#FB7122"] as const
