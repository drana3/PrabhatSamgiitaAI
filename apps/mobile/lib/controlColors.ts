import type { AmTheme } from "@/constants/tokens/amColors"

/**
 * Outline of a field, a button, an empty tick or radio circle, and the track of an off switch.
 * `line` only divides rows (white 9 percent in Dark: 1.26:1, invisible as an outline), so in Dark these controls use the
 * tokens made for them (`lineStrong`, 3.3:1; `trackOff`, 3.7:1). In Light `line` already reads, so nothing changes there.
 * Rules: docs/ui-colour-system.md, "Outlines and tracks".
 */
type ControlTheme = Pick<AmTheme, "line" | "lineStrong" | "trackOff"> & { dark: boolean }

export function controlBorder(theme: ControlTheme): string {
  return theme.dark ? theme.lineStrong : theme.line
}

export function switchTrackOff(theme: ControlTheme): string {
  return theme.dark ? theme.trackOff : theme.line
}
