/**
 * The age rule at sign-up: the app is for people of 16 and older (docs/age-confirmation.md).
 * - Creating an account with e-mail needs the tick "I'm 16 or older" (checkbox, never pre-ticked).
 * - Apple / Google first sign-in has no tick, only the line "By continuing you confirm you are 16 or older."
 * - Signing in to an existing account asks nothing.
 */
export const MINIMUM_AGE = 16

export type AgeFormMode = "signin" | "signup"

/** True when the form must show the tick: only when a NEW account is made with e-mail. */
export function needsAgeTick(mode: AgeFormMode): boolean {
  return mode === "signup"
}

/** Can the form be sent? A sign-up needs the tick; a sign-in does not care. */
export function ageGateOk(mode: AgeFormMode, ticked: boolean): boolean {
  return mode !== "signup" || ticked
}
