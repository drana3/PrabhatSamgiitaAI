import { amColors, amDarkSurface, type AmTheme } from "./amColors"

/**
 * Songs area palette: the `--am-*` variables of the prototype (.app and .app.dark in
 * Main.dc.html) that AmTheme does not carry. Imported directly, not through index.ts,
 * so parallel redesign branches do not collide.
 */
export type SongsTheme = AmTheme & {
  dark: boolean
  /** strongest ink: ink-900 in Light, #F5F2EF in Dark */
  ink900: string
  /** quiet ink for group headers and heading second lines: ink-300 */
  ink300: string
  /** text on an ink-900 fill (active chip, bubble, toast) */
  onInk: string
  /** orange-100 fill: peach in Light, brown in Dark */
  peach: string
  /** orange-700 text accent: heart, over-labels */
  accent: string
  /** olive card ground / text / over-label (sage-200, sage-900, sage-700) */
  oliveBg: string
  oliveText: string
  oliveOver: string
}

export function songsTheme(am: AmTheme, dark: boolean): SongsTheme {
  return {
    ...am,
    dark,
    ink900: dark ? amDarkSurface.heading : amColors.ink900,
    ink300: dark ? amDarkSurface.muted : amColors.ink300,
    onInk: dark ? amDarkSurface.onLight : amColors.white,
    peach: dark ? amDarkSurface.peach : amColors.orange100,
    accent: dark ? amColors.gold300 : amColors.orange700,
    oliveBg: amColors.sage200,
    oliveText: amColors.sage900,
    oliveOver: amColors.sage700,
  }
}
