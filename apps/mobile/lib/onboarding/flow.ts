import { NAV_V2_TABS } from "@/lib/navV2"

/**
 * The rules of the first-run onboarding, with no React and no storage so they are tested
 * (docs/onboarding.md). The path:
 *
 *   Welcome -> 1 Language -> 2 Sign in -> 3 What is inside -> the Kiirtan tab (+ the one-time hint)
 *   Welcome -> "I have an account" -> Sign in -> "Your songs are back" -> the Kiirtan tab (+ hint)
 *
 * No notifications step, no usage-data step, no theme step, no "Start with one", no Skip.
 */

/** Where the person is. `done` means the onboarding was finished (or never needs to run again). */
export type OnboardingStep = "welcome" | "language" | "signin" | "inside"
export type StoredStep = OnboardingStep | "done"

export const ONBOARDING_STEPS: readonly OnboardingStep[] = ["welcome", "language", "signin", "inside"]

/** The numbered steps of the progress bar. The welcome screen is step 0 and has no bar. */
export const TOTAL_STEPS = 3

export const ONBOARDING_ROUTES: Record<OnboardingStep, string> = {
  welcome: "/welcome",
  language: "/onboarding/language",
  signin: "/onboarding/signin",
  inside: "/onboarding/inside",
}

/** Route prefix of every onboarding screen (the mini-player and the tab bar stay away from it). */
export const ONBOARDING_PREFIX = "/onboarding"

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === "string" && (ONBOARDING_STEPS as readonly string[]).includes(value)
}

/** A stored value made safe: anything unknown starts again at the welcome screen. */
export function normalizeStoredStep(value: unknown): StoredStep {
  return value === "done" || isOnboardingStep(value) ? value : "welcome"
}

/** 1, 2 or 3 for the numbered steps, 0 for the welcome screen. */
export function stepNumber(step: OnboardingStep): number {
  return Math.max(0, ONBOARDING_STEPS.indexOf(step))
}

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) + 1] ?? null
}

export function previousStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step)
  return index > 0 ? ONBOARDING_STEPS[index - 1]! : null
}

export type Entry = { to: "app" } | { to: "onboarding"; route: string; step: OnboardingStep }

/**
 * Where the app opens.
 *
 * - A person who already finished the old welcome screen (`hasCompletedWelcome`) never sees the
 *   onboarding: they go straight into the app. This is also what keeps everyone who installed before
 *   this onboarding existed out of it.
 * - A new person starts at the stored step, so an app closed in the middle of the onboarding opens on
 *   the step it was closed on. A finished or unknown step starts again at the welcome screen.
 */
export function entryRoute(input: { hasCompletedWelcome: boolean; step: StoredStep }): Entry {
  if (input.hasCompletedWelcome) return { to: "app" }
  const step: OnboardingStep = input.step === "done" ? "welcome" : input.step
  return { to: "onboarding", route: ONBOARDING_ROUTES[step], step }
}

/** The page the person lands on when the onboarding ends: the Kiirtan tab. */
export function landingRoute(): string {
  return NAV_V2_TABS.find((tab) => tab.id === "kiirtan")?.href ?? "/v2/kiirtan"
}

/** True on the Kiirtan tab itself (not on a recording's page or other screens that belong to the tab). */
export function isKiirtanTabPath(pathname: string): boolean {
  const target = landingRoute()
  return pathname === target || pathname === `${target}/`
}

/** The one-time Kiirtan hint: pending after the onboarding, and only on the Kiirtan tab. */
export function shouldShowKiirtanHint(input: { pending: boolean; pathname: string }): boolean {
  return input.pending && isKiirtanTabPath(input.pathname)
}

export type SignInStepResult = { needsName?: boolean; needsPhone?: boolean }

/**
 * Where a successful sign-in leads. A new person goes on to step 3; a returning one sees "Your songs are
 * back" first. The onboarding never asks for a phone number, whatever the server says.
 */
export function afterOnboardingSignIn(returning: boolean): { route: string; step: OnboardingStep | "back" } {
  return returning ? { route: "/onboarding/back", step: "back" } : { route: ONBOARDING_ROUTES.inside, step: "inside" }
}

/** First name for "Dada, everything you saved is on this phone again": nothing for a guest or an empty name. */
export function firstNameFor(displayName: string, mode: "guest" | "signed_in"): string | null {
  if (mode !== "signed_in") return null
  const first = displayName.trim().split(/\s+/)[0] ?? ""
  if (!first || /^(guest|apple|member)$/i.test(first)) return null
  return first
}
