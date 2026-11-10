import { savesCallForPrompt } from "@/lib/guest/signInPrompt"
import { useAuthStore } from "@/stores/authStore"
import { useGuestPromptStore } from "@/stores/guestPromptStore"
import { useKirtanStore } from "@/stores/kirtanStore"
import { usePreferencesStore } from "@/stores/preferencesStore"

/** What a guest has saved on this phone: songs in Mine plus saved Kiirtans and the other recordings. */
export function guestSavedCount(): number {
  return usePreferencesStore.getState().savedSongIds.length + useKirtanStore.getState().savedIds.length
}

/**
 * A save just happened. For a guest it may be the one that asks: the 3rd saved item (and a later one once the
 * week is over). The sheet itself waits until the Save sheet has closed and the music is not playing.
 * Returns true when a request was made.
 */
export function noteGuestSaved(): boolean {
  if (useAuthStore.getState().mode !== "guest") return false
  if (!savesCallForPrompt(guestSavedCount())) return false
  return useGuestPromptStore.getState().request("saves")
}
