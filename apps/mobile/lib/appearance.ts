import { amDark, amLight, type AmTheme } from "@/constants/tokens/amColors"

/** What the user picks in Profile > Appearance. Auto follows the system. */
export type AppearancePreference = "light" | "dark" | "auto"
/** What the system reports. `null` / `undefined` when it has no answer. */
export type SystemScheme = "light" | "dark" | null | undefined
export type ResolvedAppearance = "light" | "dark"

export const APPEARANCE_PREFERENCES: readonly AppearancePreference[] = ["light", "dark", "auto"]

/** Existing installs keep seeing the light theme until the user chooses otherwise. */
export const DEFAULT_APPEARANCE: AppearancePreference = "light"

export const APPEARANCE_LABELS: Record<AppearancePreference, string> = {
  light: "Light",
  dark: "Dark",
  auto: "Auto",
}

export function isAppearancePreference(value: unknown): value is AppearancePreference {
  return value === "light" || value === "dark" || value === "auto"
}

/** Accepts anything read from storage; unknown values fall back to the default. */
export function normalizeAppearance(value: unknown): AppearancePreference {
  return isAppearancePreference(value) ? value : DEFAULT_APPEARANCE
}

/** Light and Dark win over the system; Auto follows it and falls back to light. */
export function resolveAppearance(
  preference: AppearancePreference,
  system: SystemScheme,
): ResolvedAppearance {
  if (preference === "light") return "light"
  if (preference === "dark") return "dark"
  return system === "dark" ? "dark" : "light"
}

export function themeFor(resolved: ResolvedAppearance): AmTheme {
  return resolved === "dark" ? amDark : amLight
}

export function resolveAmTheme(preference: AppearancePreference, system: SystemScheme): AmTheme {
  return themeFor(resolveAppearance(preference, system))
}

/** Status bar content colour that reads on the resolved theme. */
export function statusBarStyleFor(resolved: ResolvedAppearance): "light" | "dark" {
  return resolved === "dark" ? "light" : "dark"
}

/** Learning > Review style (SCR-27). The sheet only stores and shows the choice. */
export type ReviewStyle = "simple" | "adaptive" | "daily"

export const REVIEW_STYLES: readonly ReviewStyle[] = ["simple", "adaptive", "daily"]
export const DEFAULT_REVIEW_STYLE: ReviewStyle = "simple"

export const REVIEW_STYLE_LABELS: Record<ReviewStyle, string> = {
  simple: "Simple steps",
  adaptive: "Adaptive",
  daily: "Daily practice",
}

export function normalizeReviewStyle(value: unknown): ReviewStyle {
  return value === "simple" || value === "adaptive" || value === "daily"
    ? value
    : DEFAULT_REVIEW_STYLE
}

export type AppearanceState = {
  appearance: AppearancePreference
  reviewStyle: ReviewStyle
}

export const APPEARANCE_STORE_VERSION = 1

/**
 * Persistence migration for the appearance store. Version 0 (nothing stored,
 * or a payload from before this store existed) and damaged payloads both
 * land on the defaults, so an update can never leave the app without a theme.
 */
export function migrateAppearanceState(persisted: unknown, _version?: number): AppearanceState {
  const source =
    persisted && typeof persisted === "object" ? (persisted as Record<string, unknown>) : {}
  return {
    appearance: normalizeAppearance(source.appearance),
    reviewStyle: normalizeReviewStyle(source.reviewStyle),
  }
}
