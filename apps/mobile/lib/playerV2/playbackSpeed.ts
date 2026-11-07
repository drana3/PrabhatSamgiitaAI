/** Playback speed 0.5x to 1.5x (PLR-03). Pitch is corrected by the engine. */
export const SPEED_STEPS = [0.5, 0.75, 1, 1.25, 1.5] as const
export const SPEED_MIN = 0.5
export const SPEED_MAX = 1.5

export function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.round(rate * 100) / 100))
}

export function formatRate(rate: number): string {
  const text = String(clampRate(rate))
  return `${text}x`
}

/** Next step in the cycle; from an off-grid rate it goes to the next higher step. */
export function nextRate(rate: number): number {
  const higher = SPEED_STEPS.find((s) => s > rate + 1e-9)
  return higher ?? SPEED_STEPS[0]
}
