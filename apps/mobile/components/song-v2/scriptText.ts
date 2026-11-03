import type { TextStyle } from "react-native"

import { amFonts } from "@/constants/tokens/amTypography"
import type { ScriptId } from "@/lib/songPage/scripts"

/** Font for a script: Roboto for Roman, Noto for Devanagari and Bengali (loaded in the song screen). */
export function scriptTextStyle(script: ScriptId, size: number, bold = false): TextStyle {
  if (script === "devanagari") {
    return {
      fontFamily: bold ? amFonts.devanagariBold : amFonts.devanagari,
      fontSize: size,
      lineHeight: Math.round(size * 1.7),
    }
  }
  if (script === "bengali") {
    return {
      fontFamily: bold ? amFonts.bengaliBold : amFonts.bengali,
      fontSize: size,
      lineHeight: Math.round(size * 1.7),
    }
  }
  return { fontFamily: bold ? amFonts.bold : amFonts.medium, fontSize: size, lineHeight: Math.round(size * 1.4) }
}
