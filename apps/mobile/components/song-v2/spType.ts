import type { TextStyle } from "react-native"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"

/**
 * Text roles of the prototype CSS (`.over`, `.t-sec-h2`, `.body-t`, `.note` ...). Sizes, weights and
 * letter-spacing are the CSS values; letter-spacing in em is converted to px for the size it is used at.
 */
const em = (size: number, value: number) => Math.round(size * value * 100) / 100

/** `.over`: 600 13/16, +0.08em, uppercase, orange-700 */
export function over(t: SpTheme): TextStyle {
  return {
    fontFamily: amFonts.semi,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: em(13, 0.08),
    textTransform: "uppercase",
    color: t.orange700,
  }
}

/** `.t-sec-h2`: 800 30/30, -0.02em, uppercase */
export function secH2(t: SpTheme, size = 30): TextStyle {
  return {
    fontFamily: amFonts.display,
    fontSize: size,
    lineHeight: size,
    letterSpacing: em(size, -0.02),
    textTransform: "uppercase",
    color: t.ink800,
  }
}

/** `.body-t`: 17 / 1.55, 400 */
export function bodyT(t: SpTheme): TextStyle {
  return { fontFamily: amFonts.regular, fontSize: 17, lineHeight: 26.35, color: t.ink800 }
}

/** `.note`: 13/18, 500, ink-500 */
export function note(t: SpTheme): TextStyle {
  return { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, color: t.ink500 }
}

/** `.pill`: 600 16 */
export const pillText: TextStyle = { fontFamily: amFonts.semi, fontSize: 16 }
