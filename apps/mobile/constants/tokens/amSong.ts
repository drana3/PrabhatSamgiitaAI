import { amColors, amDarkSurface } from "./amColors"
/**
 * Tokens of the Song area, copied from the `--am-*` variables of the design prototype
 * (apps/mobile/public/mockup/Main.dc.html, `.app` and `.app.dark`). Values are not re-typed
 * elsewhere: the Song page, the story sheet and the harmonium screens all read this file.
 */
export type SpTheme = {
  dark: boolean
  orange100: string
  /** bright orange: graphics only (icons, progress, dots, glows). Never behind text. */
  orange500: string
  orange600: string
  /** ACCENT TEXT role: orange800 in Light, gold300 in Dark (never a fill; fills use `action`) */
  orange700: string
  /** action fill (primary button, selected chip): orange700 in both themes, white text */
  action: string
  actionPress: string
  onAction: string
  accentBright: string
  /** accent text on the page: orange800 Light, orange500 Dark */
  accentText: string
  dangerText: string
  gold300: string
  logoSun: string
  sage200: string
  sage300: string
  sage700: string
  sage800: string
  sage900: string
  olive100: string
  olive700: string
  sand100: string
  sand200: string
  sand300: string
  sand400: string
  white: string
  ink900: string
  ink800: string
  ink500: string
  ink300: string
  glass: string
  glassStrong: string
  glassSolid: string
  glassDark: string
  glassEdge: string
  danger: string
  /** text on an ink-coloured button */
  onInk: string
  scrim: string
}

export const spLight: SpTheme = {
  dark: false,
  orange100: "#FFDCC5",
  orange500: "#F67931",
  orange600: "#E5610F",
  orange700: amColors.orange800,
  action: amColors.orange700,
  actionPress: amColors.orange800,
  onAction: amColors.white,
  accentBright: amColors.orange500,
  accentText: amColors.orange800,
  dangerText: amColors.dangerText,
  gold300: "#F5C253",
  logoSun: "#FECC31",
  sage200: "#E5E4D4",
  sage300: "#C4CBAF",
  sage700: "#3C5535",
  sage800: "#2C3A27",
  sage900: "#20281A",
  olive100: "#DFE5C6",
  olive700: "#5B6B24",
  sand100: "#F5F2EF",
  sand200: "#EEE9E5",
  sand300: "#E9E4E0",
  sand400: "#D8D1CA",
  white: "#FFFFFF",
  ink900: "#1E1E1E",
  ink800: "#333333",
  ink500: "#68635F",
  /** second tone of two-tone headings and ring borders (4:1 on sand200); never the raw #B3B3B3 */
  ink300: amColors.headingSecond,
  glass: "rgba(255,255,255,0.55)",
  glassStrong: "rgba(255,255,255,0.72)",
  glassSolid: "rgba(255,255,255,0.9)",
  glassDark: "rgba(32,40,26,0.35)",
  glassEdge: "rgba(255,255,255,0.7)",
  danger: "#EC221F",
  onInk: "#FFFFFF",
  scrim: "rgba(30,30,30,0.45)",
}

/** `.app.dark` remaps these variables and leaves the rest as they are. */
export const spDark: SpTheme = {
  ...spLight,
  dark: true,
  orange100: amDarkSurface.peach,
  sand100: amDarkSurface.inner,
  sand200: amDarkSurface.page,
  sand300: amDarkSurface.line,
  sand400: amDarkSurface.tile,
  white: amDarkSurface.card,
  ink900: amDarkSurface.heading,
  ink800: amDarkSurface.heading,
  ink500: amDarkSurface.body,
  ink300: amDarkSurface.muted,
  orange700: amColors.gold300,
  accentText: amColors.orange500,
  dangerText: amDarkSurface.dangerText,
  onInk: amDarkSurface.onLight,
  glass: amDarkSurface.glass,
  glassStrong: amDarkSurface.glassStrong,
  glassSolid: amDarkSurface.glassSolid,
  glassEdge: amDarkSurface.glassEdge,
}

/** Radii of the prototype (`--radius-*`). */
export const spRadius = { lg: 20, xl: 30, xxl: 40, pill: 70 } as const

/** Phone top inset the prototype reserves for the status bar; used where the device reports none (web). */
export const SP_STATUS_BAR = 54
