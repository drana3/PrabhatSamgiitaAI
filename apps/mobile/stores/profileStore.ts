import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { useAuthStore } from "@/stores/authStore"

type ProfileState = {
  /** Name the person chose on Edit profile. `null` until they save one; the account name shows until then. */
  name: string | null
  /** Picture the person chose: a 512 px square JPEG as a data URI. Beats the provider picture. */
  photoUri: string | null
  /** Picture the sign-in provider gave (Google): an https URL. */
  providerPhotoUrl: string | null
  setProfile: (input: { name?: string | null; photoUri?: string | null }) => void
  setProviderPhoto: (url: string | null) => void
  /** Sign-out on a shared phone: nothing of the person stays. */
  reset: () => void
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      name: null,
      photoUri: null,
      providerPhotoUrl: null,
      setProfile: (input) =>
        set((state) => ({
          name: input.name === undefined ? state.name : input.name,
          photoUri: input.photoUri === undefined ? state.photoUri : input.photoUri,
        })),
      setProviderPhoto: (url) => set({ providerPhotoUrl: url && /^https:\/\//i.test(url) ? url : null }),
      reset: () => set({ name: null, photoUri: null, providerPhotoUrl: null }),
    }),
    {
      name: "prabhat-profile",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ name: state.name, photoUri: state.photoUri, providerPhotoUrl: state.providerPhotoUrl }),
    },
  ),
)

/** The picture to draw: the one the person chose, else the provider's, else none (initial letter). */
export function pickAvatarPhoto(state: Pick<ProfileState, "photoUri" | "providerPhotoUrl">): string | null {
  return state.photoUri || state.providerPhotoUrl || null
}

// Signing out (any way: Sign out, Delete account data, session ended) takes the person's name and picture off the phone.
useAuthStore.subscribe((state, previous) => {
  if (previous.mode === "signed_in" && state.mode === "guest") useProfileStore.getState().reset()
})
