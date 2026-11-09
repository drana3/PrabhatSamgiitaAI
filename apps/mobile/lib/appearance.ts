import { t } from "@/lib/i18n"
import { amDark, amLight, type AmTheme } from "@/constants/tokens/amColors"

/** What the user picks in Profile > Appearance. Auto follows the system. */
export type AppearancePreference = "light" | "dark" | "auto"
/** What the system reports. `null` / `undefined` when it has no answer. */
export type SystemScheme = "light" | "dark" | null | undefined
export type ResolvedAppearance = "light" | "dark"

export const APPEARANCE_PREFERENCES: readonly AppearancePreference[] = ["light", "dark", "auto"]

/** New installs follow the phone (Auto). Decided 10 Nov 2026; there is no theme choice in onboarding. */
export const DEFAULT_APPEARANCE: AppearancePreference = "auto"

/**
 * What every install that existed before Auto became the default was showing: Light. Those installs
 * keep it until the person changes it in Profile > Appearance (see `settleAppearance`).
 */
export const LEGACY_APPEARANCE: AppearancePreference = "light"

export const APPEARANCE_LABELS: Record<AppearancePreference, string> = {
  get light() {
    return t("profile.appearance.light")
  },
  get dark() {
    return t("profile.appearance.dark")
  },
  get auto() {
    return t("profile.appearance.auto")
  },
}

export function isAppearancePreference(value: unknown): value is AppearancePreference {
  return value === "light" || value === "dark" || value === "auto"
}

/** Accepts anything read from storage; unknown values fall back to `fallback` (the default for a new install). */
export function normalizeAppearance(
  value: unknown,
  fallback: AppearancePreference = DEFAULT_APPEARANCE,
): AppearancePreference {
  return isAppearancePreference(value) ? value : fallback
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

/**
 * What to tell the operating system, so its own pieces (Alerts, keyboard, photo picker, the Apple
 * button) match the app theme. Auto hands control back to the system (null).
 */
export function nativeColorSchemeFor(preference: AppearancePreference): "light" | "dark" | null {
  if (preference === "light") return "light"
  if (preference === "dark") return "dark"
  return null
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
  get simple() {
    return t("reviewStyle.simple")
  },
  get adaptive() {
    return t("reviewStyle.adaptive")
  },
  get daily() {
    return t("reviewStyle.daily")
  },
}

export function normalizeReviewStyle(value: unknown): ReviewStyle {
  return value === "simple" || value === "adaptive" || value === "daily"
    ? value
    : DEFAULT_REVIEW_STYLE
}

export type AppearanceState = {
  appearance: AppearancePreference
  reviewStyle: ReviewStyle
  /**
   * True once the theme is a decision and not just the default: the person chose it, or an install that
   * was there before Auto was pinned to what it showed. Until then `settleAppearance` still has a say.
   */
  appearanceSettled: boolean
}

export const APPEARANCE_STORE_VERSION = 2

/**
 * Persistence migration for the appearance store.
 *
 * - Nothing stored (a new install), or junk: the defaults, Auto, not settled yet.
 * - A payload that exists (version 1 and older: an install that was already using the app): the stored
 *   choice is kept; a missing or damaged value means Light, which is what that install was showing.
 */
export function migrateAppearanceState(persisted: unknown, _version?: number): AppearanceState {
  if (!persisted || typeof persisted !== "object") {
    return { appearance: DEFAULT_APPEARANCE, reviewStyle: DEFAULT_REVIEW_STYLE, appearanceSettled: false }
  }
  const source = persisted as Record<string, unknown>
  return {
    appearance: normalizeAppearance(source.appearance, LEGACY_APPEARANCE),
    reviewStyle: normalizeReviewStyle(source.reviewStyle),
    appearanceSettled: true,
  }
}

/**
 * The theme an install should have once its stores have loaded, for a state that is not settled yet.
 * A person who already finished the old welcome screen was using the app before Auto existed, so they
 * keep Light. A person who has not (a new install, or one still in onboarding) keeps the default, Auto.
 * Returns `null` when nothing needs to change.
 */
export function settleAppearance(
  state: Pick<AppearanceState, "appearance" | "appearanceSettled">,
  hasCompletedWelcome: boolean,
): AppearancePreference | null {
  if (state.appearanceSettled) return null
  return hasCompletedWelcome ? LEGACY_APPEARANCE : state.appearance
}
