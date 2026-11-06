import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { keepSavedState } from "@/lib/persistMigrate"
import { useAuthStore } from "@/stores/authStore"

type ProfileData = {
  /** Who the saved data belongs to (see `profileOwnerKey`). Data of another owner is never shown. */
  owner: string | null
  /** Name the person chose on Edit profile. `null` until they save one; the account name shows until then. */
  name: string | null
  /** Picture the person chose: a 512 px square JPEG as a data URI. Beats the provider picture. */
  photoUri: string | null
  /** Picture the sign-in provider gave (Google): an https URL. */
  providerPhotoUrl: string | null
}

type ProfileState = ProfileData & {
  setProfile: (input: { name?: string | null; photoUri?: string | null }) => void
  setProviderPhoto: (url: string | null) => void
  /** Forget everything, whoever it belonged to. */
  reset: () => void
}

const EMPTY: ProfileData = { owner: null, name: null, photoUri: null, providerPhotoUrl: null }

/**
 * Owner of the profile on this phone: "guest" for a guest, `member:<id>` for a signed-in account (the
 * account id, else the email). A guest's local profile lives under "guest" only.
 */
export function profileOwnerKey(auth: { mode: "guest" | "signed_in"; memberId: string | null; email: string | null }): string {
  if (auth.mode !== "signed_in") return "guest"
  const id = (auth.memberId || "").trim() || (auth.email || "").trim().toLowerCase()
  return `member:${id}`
}

function currentOwner(): string {
  return profileOwnerKey(useAuthStore.getState())
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      ...EMPTY,
      setProfile: (input) =>
        set((state) => {
          const owner = currentOwner()
          // Data of another owner never carries over into a new save.
          const base = state.owner === owner ? state : EMPTY
          return {
            ...base,
            owner,
            name: input.name === undefined ? base.name : input.name,
            photoUri: input.photoUri === undefined ? base.photoUri : input.photoUri,
          }
        }),
      setProviderPhoto: (url) =>
        set((state) => {
          const owner = currentOwner()
          const base = state.owner === owner ? state : EMPTY
          return { ...base, owner, providerPhotoUrl: url && /^https:\/\//i.test(url) ? url : null }
        }),
      reset: () => set({ ...EMPTY }),
    }),
    {
      name: "prabhat-profile",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (saved) => keepSavedState<ProfileData>(saved),
      // Saved data with no owner (an older build) must not inherit the owner the in-memory state holds.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<ProfileData>
        return { ...current, ...saved, owner: saved.owner ?? null }
      },
      partialize: (state) => ({
        owner: state.owner,
        name: state.name,
        photoUri: state.photoUri,
        providerPhotoUrl: state.providerPhotoUrl,
      }),
    },
  ),
)

/** The picture to draw: the one the person chose, else the provider's, else none (initial letter). */
export function pickAvatarPhoto(state: Pick<ProfileState, "photoUri" | "providerPhotoUrl">): string | null {
  return state.photoUri || state.providerPhotoUrl || null
}

/**
 * Drops saved data that does not belong to the account (or guest) in use now. Runs on every auth change
 * and when both stores have finished loading from disk; before that the auth store still holds its
 * "guest" default, so comparing would wrongly wipe a signed-in person's profile on every cold start.
 * Data with no owner (saved by an older build) is dropped too.
 */
export function reconcileProfileOwner(): void {
  if (!useProfileStore.persist.hasHydrated() || !useAuthStore.persist.hasHydrated()) return
  const state = useProfileStore.getState()
  const hasData = Boolean(state.name || state.photoUri || state.providerPhotoUrl)
  if (state.owner === currentOwner()) return
  if (!hasData && state.owner === null) {
    useProfileStore.setState({ owner: currentOwner() })
    return
  }
  useProfileStore.setState({ ...EMPTY, owner: currentOwner() })
}

useAuthStore.subscribe(() => reconcileProfileOwner())
useAuthStore.persist.onFinishHydration(() => reconcileProfileOwner())
useProfileStore.persist.onFinishHydration(() => reconcileProfileOwner())
reconcileProfileOwner()
