import type { GuestPromptKind } from "@/lib/guest/signInPrompt"
import { useGuestPromptStore } from "@/stores/guestPromptStore"

/**
 * A guest tapped something that needs an account (Upload, the comment box). If the sheet is due (a guest, and not shown
 * for this kind in the last week) it is put up and `after` runs when it closes, whichever way. If it is not due,
 * `instead` runs at once: the screen does what it did before the sheet existed.
 */
export function askGuestToSignIn(kind: GuestPromptKind, options: { after?: () => void; instead?: () => void } = {}): void {
  const asked = useGuestPromptStore.getState().request(kind, { then: options.after })
  if (!asked) options.instead?.()
}
