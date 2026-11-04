import type { TextStyle } from "react-native"

/**
 * Roboto across the app, Noto for scripts Roboto does not cover.
 * Font names are the ones registered by @expo-google-fonts.
 */
export const amFonts = {
  display: "Roboto_800ExtraBold",
  bold: "Roboto_700Bold",
  semi: "Roboto_600SemiBold",
  medium: "Roboto_500Medium",
  regular: "Roboto_400Regular",
  devanagari: "NotoSansDevanagari_400Regular",
  devanagariBold: "NotoSansDevanagari_700Bold",
  /** The prototype asks for Noto Sans Devanagari 400 and 600 only, so its bold lyrics render at 600. */
  devanagariSemi: "NotoSansDevanagari_600SemiBold",
  bengali: "NotoSansBengali_400Regular",
  bengaliBold: "NotoSansBengali_700Bold",
} as const

/** Size steps of the site on a phone. */
export const amFontSize = {
  display: 45,
  title: 30,
  heading: 24,
  lead: 19,
  body: 16,
  label: 13,
} as const

/** Display tracking: -0.02em; labels: +0.08em. */
export const amTracking = {
  display: -0.02,
  label: 0.08,
} as const

function em(size: number, tracking: number): number {
  return Math.round(size * tracking * 100) / 100
}

export const amType = {
  /** page and section headings: uppercase, extrabold, tight */
  display: {
    fontFamily: amFonts.display,
    fontSize: amFontSize.display,
    lineHeight: Math.round(amFontSize.display * 0.95),
    letterSpacing: em(amFontSize.display, amTracking.display),
    textTransform: "uppercase",
  } satisfies TextStyle,
  title: {
    fontFamily: amFonts.display,
    fontSize: amFontSize.title,
    lineHeight: amFontSize.title,
    letterSpacing: em(amFontSize.title, amTracking.display),
    textTransform: "uppercase",
  } satisfies TextStyle,
  heading: {
    fontFamily: amFonts.semi,
    fontSize: amFontSize.heading,
    lineHeight: Math.round(amFontSize.heading * 1.1),
  } satisfies TextStyle,
  lead: {
    fontFamily: amFonts.medium,
    fontSize: amFontSize.lead,
    lineHeight: Math.round(amFontSize.lead * 1.3),
  } satisfies TextStyle,
  body: {
    fontFamily: amFonts.regular,
    fontSize: amFontSize.body,
    lineHeight: Math.round(amFontSize.body * 1.45),
  } satisfies TextStyle,
  /** eyebrow / overline: 13px, 600, uppercase, +0.08em */
  label: {
    fontFamily: amFonts.semi,
    fontSize: amFontSize.label,
    lineHeight: Math.round(amFontSize.label * 1.2),
    letterSpacing: em(amFontSize.label, amTracking.label),
    textTransform: "uppercase",
  } satisfies TextStyle,
} as const
