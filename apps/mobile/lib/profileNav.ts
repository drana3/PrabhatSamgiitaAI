import { NAV_V2_PROFILE_SHEET_ROUTE } from "@/lib/navV2"
import { PROFILE_ROUTES } from "@/lib/profileSheet"

/**
 * THE rule for the way back from the profile sheet (the hub of every setting): a row of the sheet always PUSHES its page,
 * never replaces the sheet, so the sheet stays one step down in the stack and Back (the button, the Done of a sheet, the
 * swipe, the Android back key) lands on it. Before, five rows (Your library, History, Language, Script and
 * translations, Review style) replaced the sheet "like the prototype", and Back from them dropped the person on Today
 * or Songs, who then had to open the profile again.
 *
 * Pure (no router import), so the stack can be unit tested: `openFromProfile` says what a row does, `applyNav` plays it
 * on a list of routes the way the navigator does (__tests__/profileBack.test.ts).
 */

/** What a navigation call does to the stack of routes. */
export type NavAction = { type: "push" | "replace"; to: string } | { type: "back" } | { type: "dismissTo"; to: string }

/** Every page a row of the profile sheet opens (plus the avatar block's Edit profile and the notification settings). */
export const PROFILE_INNER_ROUTES: readonly string[] = [...Object.values(PROFILE_ROUTES), "/notification-settings"]

/** What tapping a row of the profile sheet does: push the page above the sheet. */
export function openFromProfile(route: string): NavAction {
  return { type: "push", to: route }
}

/** Plays an action on a stack of route names (bottom first), as expo-router does; Back on the last page leaves it. */
export function applyNav(stack: readonly string[], action: NavAction): string[] {
  switch (action.type) {
    case "push":
      return [...stack, action.to]
    case "replace":
      return [...stack.slice(0, -1), action.to]
    case "back":
      return stack.length > 1 ? stack.slice(0, -1) : [...stack]
    case "dismissTo": {
      const at = stack.lastIndexOf(action.to)
      return at >= 0 ? stack.slice(0, at + 1) : [...stack, action.to]
    }
  }
}

/** The route the profile sheet has in the stack. */
export const PROFILE_SHEET = NAV_V2_PROFILE_SHEET_ROUTE
