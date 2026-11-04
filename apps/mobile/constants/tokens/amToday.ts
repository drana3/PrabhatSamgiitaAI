import { amColors, type AmTheme } from "@/constants/tokens/amColors"
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
  orange100: "#4A2E1C",
  orange700: amColors.gold300,
  sand100: "#262F20",
  sand200: "#161B12",
  sand300: "rgba(255, 255, 255, 0.12)",
  sand400: "#3B4634",
  white: "#222B1D",
  ink900: "#F5F2EF",
  ink800: "#F2EFE9",
  ink500: "#B7BCA6",
  ink300: "#6A7761",
  onInk: "#20281A",
  glassStrong: "rgba(34, 43, 29, 0.78)",
  glassSolid: "rgba(34, 43, 29, 0.92)",
  glassEdge: "rgba(255, 255, 255, 0.16)",
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
