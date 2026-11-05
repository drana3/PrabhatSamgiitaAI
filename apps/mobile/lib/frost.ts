export type FrostTint = "light" | "dark"

/**
 * Android has no real backdrop blur in expo-blur without the heavy `dimezisBlurView` method, so a
 * "frosted" layer there is a plain translucent fill. This picks one that keeps the contrast the blurred
 * version has on iOS: stronger intensity means a more opaque fill.
 */
export function frostFallbackColor(tint: FrostTint, intensity: number): string {
  const clamped = Math.min(100, Math.max(0, intensity))
  const alpha = Math.round((0.45 + (clamped / 100) * 0.4) * 100) / 100
  return tint === "dark" ? `rgba(20, 18, 16, ${alpha})` : `rgba(255, 255, 255, ${alpha})`
}
