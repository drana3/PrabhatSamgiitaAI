import { GUEST_OWNER } from "@/lib/account/owner"
import { unionIds } from "@/lib/guest/guestSaves"
import { useKirtanOwnerStore } from "@/stores/kirtanOwnerStore"
import { useKirtanStore } from "@/stores/kirtanStore"

/**
 * A guest signs in: the Kiirtans they saved on this phone join the account's saved Kiirtans.
 *
 * lib/account/owner.ts already hands the guest's whole data to the account when the account has nothing on
 * this phone yet. When the account was here before (signed out, signed in again) its own data comes back and the
 * guest's is put aside under "guest": only the saved Kiirtans are taken out of there and joined to the account's
 * (the guest's other data is not the account's). Call right after the session is applied, once the stores have
 * rotated. Returns how many saved Kiirtans the account gained.
 */
export function mergeGuestKiirtanSaves(): number {
  const owner = useKirtanOwnerStore.getState()
  const aside = owner.slots[GUEST_OWNER] as { savedIds?: unknown } | undefined
  const guestIds = Array.isArray(aside?.savedIds) ? (aside.savedIds as unknown[]).filter((id): id is string => typeof id === "string") : []
  if (!guestIds.length) return 0
  const mine = useKirtanStore.getState().savedIds
  const joined = unionIds(mine, guestIds)
  useKirtanStore.setState({ savedIds: joined })
  useKirtanOwnerStore.setState({ slots: { ...owner.slots, [GUEST_OWNER]: { ...aside, savedIds: [] } } })
  return joined.length - mine.length
}
