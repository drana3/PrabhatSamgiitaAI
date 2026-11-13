import { Appearance } from "react-native"

import { nativeColorSchemeFor, type AppearancePreference } from "@/lib/appearance"

/**
 * Pushes the Profile > Appearance choice to the OS (needs app.json userInterfaceStyle "automatic",
 * otherwise iOS ignores it and always reports light). Light and Dark pin the system pieces; Auto
 * clears the override so the system decides. Safe to call on web and in tests: it never throws.
 */
export function applyNativeColorScheme(preference: AppearancePreference) {
  try {
    if (typeof Appearance?.setColorScheme !== "function") return
    Appearance.setColorScheme(nativeColorSchemeFor(preference))
  } catch {
    // A platform without the override keeps following the system.
  }
}
