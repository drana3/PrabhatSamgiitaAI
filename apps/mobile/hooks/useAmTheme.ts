import { useColorScheme } from "react-native"

import type { AmTheme } from "@/constants/tokens/amColors"
import { resolveAmTheme, resolveAppearance, type ResolvedAppearance } from "@/lib/appearance"
import { useAppearanceStore } from "@/stores/appearanceStore"

/**
 * Theme for redesign screens: amLight or amDark, from the Profile >
 * Appearance setting (Light, Dark, or Auto = follow the system).
 */
export function useAmTheme(): AmTheme {
  const preference = useAppearanceStore((s) => s.appearance)
  const system = useColorScheme()
  return resolveAmTheme(preference, system)
}

/** "light" or "dark" after Auto is resolved; for the status bar and similar. */
export function useResolvedAppearance(): ResolvedAppearance {
  const preference = useAppearanceStore((s) => s.appearance)
  const system = useColorScheme()
  return resolveAppearance(preference, system)
}
