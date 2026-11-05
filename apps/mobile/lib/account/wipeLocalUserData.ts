import { clearCachedMemberEmail } from "@/lib/memberEmail"
import { useChatStore } from "@/stores/chatStore"
import { useNotificationsStore } from "@/stores/notificationsStore"
import { clearPlaylistsOnDevice } from "@/stores/playlistStore"

/**
 * What leaves the phone when a person signs out or deletes the account.
 *
 *   wiped here       what the server keeps for the account and sends back on the next sign-in:
 *                    the AI chats, the playlists (list, cache on disk, waiting changes), the email cached in
 *                    memory, the notices about the person's own uploads
 *   put aside        what only lives on the phone and comes back when that account signs in again:
 *                    learning progress, saved and blocked Kiirtans, recent songs and searches, notes, where
 *                    each song stopped (stores keep it under the account, see lib/account/owner.ts)
 *   stays            the audio the person downloaded: it belongs to the phone and keeps playing, and
 *                    Storage can still remove it (the sign-out confirm says so)
 *
 * `accountId` is the chat account of the person signing out (taken BEFORE the auth store is cleared).
 * Nothing here throws: a failure of one part must not leave the rest of the data behind.
 */
export async function wipeLocalUserData(accountId?: string | null): Promise<void> {
  clearCachedMemberEmail()
  try {
    if (accountId && accountId !== "guest") useChatStore.getState().clearAccountMemory(accountId)
  } catch {
    /* keep going */
  }
  try {
    useNotificationsStore.setState((state) => ({ items: state.items.filter((item) => item.kind !== "upload") }))
  } catch {
    /* keep going */
  }
  try {
    await clearPlaylistsOnDevice()
  } catch {
    /* keep going */
  }
}
