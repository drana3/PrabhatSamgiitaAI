/**
 * Playback speed 0.5x to 2.0x. The engine keeps the pitch by default (time-stretch); the "Keep pitch" switch
 * (stores/playbackPrefsStore.ts) lets the pitch follow the speed where the engine can do that (iOS only).
 * Pure: no React, no stores.
 */
export const SPEED_MIN = 0.5
export const SPEED_MAX = 2
/** The quick choices; the fine step is {@link SPEED_FINE_STEP} (and {@link SPEED_COARSE_STEP}). */
export const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const
export const SPEED_FINE_STEP = 0.05
export const SPEED_COARSE_STEP = 0.1

export function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.round(rate * 100) / 100))
}

/** "1x", "0.75x", "1.05x" */
export function formatRate(rate: number): string {
  return `${clampRate(rate)}x`
}

/** "1×", "0.75×", "1.05×" (the multiplication sign the sheets use). */
export function formatRateSign(rate: number): string {
  return formatRate(rate).replace("x", "×")
}

/** Next step in the cycle; from an off-grid rate it goes to the next higher step; after the top it wraps to the lowest. */
export function nextRate(rate: number): number {
  const higher = SPEED_STEPS.find((s) => s > rate + 1e-9)
  return higher ?? SPEED_STEPS[0]
}

/** One press of the - or + button: `delta` is a multiple of the step, the result stays on the 0.05 grid and in range. */
export function stepRate(rate: number, delta: number): number {
  const base = Math.round(clampRate(rate) * 20) / 20
  return clampRate(Math.round((base + delta) * 20) / 20)
}

/** True when the rate is one of the quick choices (the chip row highlights it). */
export function isPresetRate(rate: number): boolean {
  return SPEED_STEPS.some((s) => Math.abs(s - rate) < 1e-9)
}
