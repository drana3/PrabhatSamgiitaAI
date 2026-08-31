/** Persist on web (localStorage) and mobile (preferences store). */
export const HARMONIUM_PRACTICE_STORAGE_KEY = "prabhat-harmonium-practice"

export const HARMONIUM_PRACTICE_HINT_SIGNED_IN =
  "Off by default. Enable it here to use the live harmonium keyboard and song notation practice."

export const HARMONIUM_PRACTICE_HINT_GUEST =
  "Sign in, then enable Harmonium practice in Profile to use the keyboard and notation tools."

export const HARMONIUM_ENABLE_IN_PROFILE_TITLE = "Enable Harmonium practice in Profile"

export const HARMONIUM_ENABLE_IN_PROFILE_BODY =
  "Turn on Harmonium practice in Profile to use the live keyboard and song notation."

export const HARMONIUM_GATE_TITLE = "Harmonium practice"

export const HARMONIUM_GATE_BODY_GUEST =
  "Sign in, then turn on Harmonium practice in your profile to use the live keyboard and song notation on this song."

export const HARMONIUM_GATE_BODY_SIGNED_IN =
  "Turn on Harmonium practice in your profile to unlock the live keyboard and song notation here."

export const HARMONIUM_GATE_ACTION_GUEST = "Sign in"
export const HARMONIUM_GATE_ACTION_PROFILE = "Open profile settings"

export function harmoniumPracticeActive(_signedIn = true, _enabled = true): boolean {
  return true
}
