import { amColors, amDarkSurface, type AmTheme } from "@/constants/tokens/amColors"
import { isDarkTheme } from "@/lib/navV2"

/**
 * The CSS variables of the prototype's `.app` and `.app.dark` (Main.dc.html lines 18-31) that
 * AmTheme does not carry. Values are copied from the prototype; the dark column is `.app.dark`.
 * Used by the Today screen, the search overlay and the profile sheets.
 */
export type AmProto = {
  dark: boolean
  orange100: string
  orange500: string
  /** eyebrow and "why" colour: orange in Light, gold in Dark */
  orange700: string
  gold300: string
  logoSun: string
  sage200: string
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
  /** text on an ink button */
  onInk: string
  glassStrong: string
  glassSolid: string
  glassEdge: string
  danger: string
}

export const protoLight: AmProto = {
  dark: false,
  orange100: amColors.orange100,
  orange500: amColors.orange500,
  orange700: amColors.orange700,
  gold300: amColors.gold300,
  logoSun: amColors.logoSun,
  sage200: amColors.sage200,
  sage700: amColors.sage700,
  sage800: amColors.sage800,
  sage900: amColors.sage900,
  olive100: amColors.olive100,
  olive700: amColors.olive700,
  sand100: amColors.sand100,
  sand200: amColors.sand200,
  sand300: amColors.sand300,
  sand400: amColors.sand400,
  white: amColors.white,
  ink900: amColors.ink900,
  ink800: amColors.ink800,
  ink500: amColors.ink500,
  ink300: amColors.ink300,
  onInk: "#FFFFFF",
  glassStrong: "rgba(255, 255, 255, 0.72)",
  glassSolid: "rgba(255, 255, 255, 0.9)",
  glassEdge: "rgba(255, 255, 255, 0.7)",
  danger: amColors.danger,
}

export const protoDark: AmProto = {
  ...protoLight,
  dark: true,
  orange100: amDarkSurface.peach,
  orange700: amColors.gold300,
  sand100: amDarkSurface.inner,
  sand200: amDarkSurface.page,
  sand300: amDarkSurface.line,
  sand400: amDarkSurface.tile,
  white: amDarkSurface.card,
  ink900: amDarkSurface.heading,
  ink800: amDarkSurface.heading,
  ink500: amDarkSurface.body,
  ink300: amDarkSurface.muted,
  onInk: amDarkSurface.onLight,
  glassStrong: amDarkSurface.glassStrong,
  glassSolid: amDarkSurface.glassSolid,
  glassEdge: amDarkSurface.glassEdge,
}

export function protoFor(theme: AmTheme): AmProto {
  return isDarkTheme(theme) ? protoDark : protoLight
}

/** Pixel measures of the prototype that more than one screen shares. */
export const amProto = {
  gutter: 10,
  /** top padding of every screen in the prototype: the status bar area */
  statusArea: 54,
  headHeight: 56,
  pillField: 56,
  hero: 290,
  heroOverlap: 60,
  /** `.pill` buttons */
  pillHeight: 48,
  sheetMaxHeight: 780,
} as const
