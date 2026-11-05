import type { SpTheme } from "@/constants/tokens/amSong"

/**
 * The orange of the song page by role (AA-safe): a fill that carries a white glyph or label, orange text, and
 * bright orange for graphics only (rings, bars, outlines). Reads the theme's colour-role tokens
 * (`action`, `onAction`, `accentText`, `accentBright`) and falls back to the older `orange*` values when a
 * theme does not have them yet.
 */
export function songAccents(t: SpTheme): { fill: string; onFill: string; text: string; bright: string } {
  const roles = t as Partial<Pick<SpTheme, "action" | "onAction" | "accentText" | "accentBright">> & SpTheme
  return {
    fill: roles.action ?? t.orange500,
    onFill: roles.onAction ?? "#FFFFFF",
    text: roles.accentText ?? (t.dark ? t.orange500 : t.orange700),
    bright: roles.accentBright ?? t.orange500,
  }
}
