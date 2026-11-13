import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { getDeviceLanguageCodes } from "@/lib/i18n/device"
import {
  DEFAULT_LANGUAGE_PREFERENCE,
  normalizeLanguagePreference,
  resolveLanguage,
  setActiveLanguage,
  type LanguagePreference,
} from "@/lib/i18n/core"

type LanguageStoreState = {
  /** 'auto' follows the device; otherwise a fixed language. A new install starts in English. */
  language: LanguagePreference
  setLanguage: (value: LanguagePreference) => void
}

/** Make the stored choice the language the app speaks. Safe to call again (e.g. when the app returns to the front under 'auto'). */
export function applyLanguagePreference(preference: LanguagePreference): void {
  setActiveLanguage(resolveLanguage(preference, getDeviceLanguageCodes()))
}

/**
 * The person's interface-language choice, persisted under `prabhat-language`. It never touches
 * song languages or translations (those live in songPageStore).
 */
export const useLanguageStore = create<LanguageStoreState>()(
  persist(
    (set) => ({
      language: DEFAULT_LANGUAGE_PREFERENCE,
      setLanguage: (value) => {
        const next = normalizeLanguagePreference(value)
        set({ language: next })
        applyLanguagePreference(next)
      },
    }),
    {
      name: "prabhat-language",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({ language: state.language }),
      merge: (persisted, current) => ({
        ...current,
        language: normalizeLanguagePreference((persisted as { language?: unknown } | undefined)?.language),
      }),
      onRehydrateStorage: () => (state) => {
        applyLanguagePreference(state?.language ?? DEFAULT_LANGUAGE_PREFERENCE)
      },
    },
  ),
)
