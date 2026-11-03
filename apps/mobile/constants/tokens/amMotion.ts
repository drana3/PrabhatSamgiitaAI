/**
 * Motion tokens (spec section 1).
 * One staggered reveal per screen on first visit; gestures use springs,
 * never CSS-style transitions. Animate only transform and opacity.
 */
export const amReveal = {
  stepMs: 80,
  riseDp: 16,
  durationMs: 320,
  /** cubic-bezier(0.2, 0.7, 0.2, 1) */
  easing: [0.2, 0.7, 0.2, 1] as const,
} as const

/**
 * Spring from the response / damping-ratio pair used in the spec.
 * Returns react-native-reanimated withSpring parameters (mass 1).
 */
export function springConfig(response: number, dampingRatio: number) {
  return {
    mass: 1,
    stiffness: (2 * Math.PI) ** 2 / response ** 2,
    damping: (4 * Math.PI * dampingRatio) / response,
  }
}

export const amSpring = {
  /** default: no overshoot */
  default: springConfig(0.35, 1),
  /** only when the gesture carried momentum: fling, throw */
  fling: springConfig(0.35, 0.8),
} as const

/** Where a gesture lands if released with velocity v (dp/s): x + (v/1000) * 0.998 / (1 - 0.998). */
export function projectMomentum(x: number, velocity: number, rate = 0.998): number {
  "worklet"
  return x + (velocity / 1000) * (rate / (1 - rate))
}
