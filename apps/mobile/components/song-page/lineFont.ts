import { amFonts } from "@/constants/tokens/amTypography"
import type { ScriptId } from "@/lib/songPage/scripts"

/** The font of a lyric line or word in the script on screen, at the reader's text size. */
export function lineFont(script: ScriptId, scale: number, weight: "bold" | "regular", base = 20) {
  const size = Math.round(base * scale)
  const lineHeight = Math.round(size * 1.4)
  if (script === "devanagari") return { fontFamily: weight === "bold" ? amFonts.devanagariBold : amFonts.devanagari, fontSize: size, lineHeight }
  if (script === "bengali") return { fontFamily: weight === "bold" ? amFonts.bengaliBold : amFonts.bengali, fontSize: size, lineHeight }
  return { fontFamily: weight === "bold" ? amFonts.bold : amFonts.regular, fontSize: size, lineHeight }
}
