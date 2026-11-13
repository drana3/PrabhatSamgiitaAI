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
  settleAppearance,
  type AppearancePreference,
  type ReviewStyle,
} from "@/lib/appearance"

type AppearanceStoreState = {
  appearance: AppearancePreference
  reviewStyle: ReviewStyle
  /** see AppearanceState.appearanceSettled in lib/appearance.ts */
  appearanceSettled: boolean
  setAppearance: (value: AppearancePreference) => void
  setReviewStyle: (value: ReviewStyle) => void
  /**
   * Run once both stores have loaded: an install that finished the old welcome before Auto was the
   * default keeps Light; a new install keeps Auto. Does nothing again after that.
   */
  settleAppearance: (hasCompletedWelcome: boolean) => void
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
      appearanceSettled: false,
      setAppearance: (value) => {
        const appearance = normalizeAppearance(value)
        set({ appearance, appearanceSettled: true })
        applyNativeColorScheme(appearance)
      },
      setReviewStyle: (value) => set({ reviewStyle: normalizeReviewStyle(value) }),
      settleAppearance: (hasCompletedWelcome) => {
        const state = useAppearanceStore.getState()
        const next = settleAppearance(state, hasCompletedWelcome)
        if (next === null) return
        set({ appearance: next, appearanceSettled: true })
        applyNativeColorScheme(next)
      },
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
        appearanceSettled: state.appearanceSettled,
      }),
    },
  ),
)
