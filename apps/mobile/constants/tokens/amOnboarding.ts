import { amDarkSurface } from "./amColors"

/**
 * The two tints the onboarding board uses that AmTheme does not carry (Для-Дады/онбординг-v2, CSS
 * variables `--wash` and `--selbg`). Both are existing colours: orange100 in light, the dark `peach`.
 * Contrast of text on them is pinned by __tests__/onboardingContrast.test.ts.
 */
export const amOnboarding = {
  light: {
    /** warm wash at the top of a step page */
    wash: "rgba(255, 220, 197, 0.75)",
    /** the selected row of a list */
    selected: "rgba(255, 220, 197, 0.5)",
  },
  dark: {
    wash: "rgba(58, 36, 24, 0.5)",
    selected: amDarkSurface.peach,
  },
  /** the dim behind the Kiirtan hint and sheets */
  dim: "rgba(0, 0, 0, 0.52)",
  dimHint: "rgba(0, 0, 0, 0.66)",
  /** welcome screen: the scrim over the dawn photo, top to bottom (rgb 20,14,10) */
  welcomeScrim: [
    "rgba(20, 14, 10, 0.58)",
    "rgba(20, 14, 10, 0.30)",
    "rgba(20, 14, 10, 0.64)",
    "rgba(20, 14, 10, 0.82)",
    "rgba(20, 14, 10, 0.92)",
    "rgba(20, 14, 10, 0.95)",
  ] as const,
  welcomeScrimStops: [0, 0.18, 0.36, 0.5, 0.64, 1] as const,
  /** Apple button ground (black) and Google button ground (white) with its ink */
  apple: "#000000",
  googleInk: "#1E1E1E",
} as const
