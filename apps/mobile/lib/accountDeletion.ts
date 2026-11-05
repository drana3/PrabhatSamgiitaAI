import { api } from "@/lib/client"
import { favoritesScopeKey } from "@/lib/favoritesScope"
import { memberAuthAvailable } from "@/lib/memberAuth"
import { completeMemberSignOut } from "@/lib/session"
import { useAuthStore } from "@/stores/authStore"
import { useChatStore } from "@/stores/chatStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { useProfileStore } from "@/stores/profileStore"

/**
 * Why a deletion did not happen. `unavailable`: this build has no member sync, so it cannot reach the account
 * on the server at all. `failed`: the server did not confirm (offline, error, not signed in there).
 */
export type AccountDeletionResult = { ok: true } | { ok: false; reason: "unavailable" | "failed" }

/** Asks the server to delete the account. Only a confirmed answer counts; nothing is cleared here. */
export async function deleteAccountOnServer(): Promise<AccountDeletionResult> {
  if (!memberAuthAvailable()) return { ok: false, reason: "unavailable" }
  try {
    const confirmed = await api.deleteMemberAccount()
    return confirmed ? { ok: true } : { ok: false, reason: "failed" }
  } catch {
    return { ok: false, reason: "failed" }
  }
}

/** What the phone keeps for the account: the AI chat memory, the profile (name, photo), the saved songs of that account. */
export function clearLocalAccountData(accountId: string) {
  const { mode, memberId, identityProvider, email } = useAuthStore.getState()
  const favoritesScope = favoritesScopeKey({ mode, memberId, identityProvider, email })
  useChatStore.getState().clearAccountMemory(accountId)
  useProfileStore.getState().reset()
  usePreferencesStore.setState((state) => {
    const favoritesByScope = { ...state.favoritesByScope }
    delete favoritesByScope[favoritesScope]
    return { favoritesByScope }
  })
}

/**
 * Delete the account for real: server first. Only when the server confirmed, the local data is cleared and the
 * person is signed out. On any failure the account and everything on the phone stay as they were.
 */
export async function deleteAccount(accountId: string): Promise<AccountDeletionResult> {
  const result = await deleteAccountOnServer()
  if (!result.ok) return result
  clearLocalAccountData(accountId)
  await completeMemberSignOut()
  return result
}
