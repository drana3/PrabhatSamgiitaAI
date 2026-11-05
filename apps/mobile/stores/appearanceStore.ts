import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { applyNativeColorScheme } from "@/lib/applyColorScheme"
import {
  APPEARANCE_STORE_VERSION,
  DEFAULT_APPEARANCE,
  DEFAULT_REVIEW_STYLE,
  migrateAppearanceState,
  normalizeAppearance,
  normalizeReviewStyle,
  type AppearancePreference,
  type ReviewStyle,
} from "@/lib/appearance"

type AppearanceStoreState = {
  appearance: AppearancePreference
  reviewStyle: ReviewStyle
  setAppearance: (value: AppearancePreference) => void
  setReviewStyle: (value: ReviewStyle) => void
}

/**
 * Redesign settings. A store of its own (persisted under its own key, the
 * way preferencesStore is) so the existing preferences payload and its
 * migration stay untouched: adding or removing this store never affects it.
 */
export const useAppearanceStore = create<AppearanceStoreState>()(
  persist(
    (set) => ({
      appearance: DEFAULT_APPEARANCE,
      reviewStyle: DEFAULT_REVIEW_STYLE,
      setAppearance: (value) => {
        const appearance = normalizeAppearance(value)
        set({ appearance })
        applyNativeColorScheme(appearance)
      },
      setReviewStyle: (value) => set({ reviewStyle: normalizeReviewStyle(value) }),
    }),
    {
      name: "prabhat-appearance",
      storage: createJSONStorage(() => AsyncStorage),
      version: APPEARANCE_STORE_VERSION,
      migrate: (persisted, version) => migrateAppearanceState(persisted, version),
      onRehydrateStorage: () => (state) => {
        if (state) applyNativeColorScheme(state.appearance)
      },
      partialize: (state) => ({
        appearance: state.appearance,
        reviewStyle: state.reviewStyle,
      }),
    },
  ),
)
