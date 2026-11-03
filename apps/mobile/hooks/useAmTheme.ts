import { amLight, type AmTheme } from "@/constants/tokens/amColors"

/**
 * Theme for redesign screens. Light only for now: the Light / Dark / Auto
 * switch arrives with the profile-sheet branch and will change only this hook.
 */
export function useAmTheme(): AmTheme {
  return amLight
}
